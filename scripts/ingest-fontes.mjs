// Builds the private study-material knowledge base the AI consults (alongside the law text).
// Reads PDFs from local folders, extracts text page by page, drops duplicate files, splits the
// text into chunks tagged with subject/file/page, and writes them to a JSON file. A second step
// (--sql) turns that JSON into SQL for the Cloudflare D1 database behind /api/fontes.
//
//   node scripts/ingest-fontes.mjs --out <dir> <folder> [<folder> ...]
//   node scripts/ingest-fontes.mjs --sql <dir>        (full rebuild)
//   node scripts/ingest-fontes.mjs --sql-new <dir>    (only PDFs not uploaded yet)
//   node scripts/ingest-fontes.mjs --commit <dir>     (after a successful D1 import)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const CHUNK = 1200;
const OVERLAP = 150;
const MIN_CHARS_PER_PAGE = 60; // below this the page is probably a scanned image

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args.splice(i, 2)[1]; };

const subjectOf = (folder) => folder
  .replace(/\b(MPES|PDF|mpes)\b/gi, '')
  .replace(/\bD\.\s*ADM\b/i, 'Direito Administrativo')
  .replace(/\s+/g, ' ').trim()
  .toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  .replace(/\b(Do|Da|Dos|Das|De|E)\b/g, (w) => w.toLowerCase())
  .replace(/\bEs\b/, 'ES').replace(/\bLgpd\b/, 'LGPD').replace(/^Ti$/, 'TI').replace(/\bMp\b/, 'MP').replace(/^Lrf$/, 'Lei de Responsabilidade Fiscal') || 'Geral';

const pageText = async (page) => {
  const content = await page.getTextContent();
  let out = '';
  let lastY = null;
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) out += '\n';
    else if (out && !out.endsWith(' ') && !item.str.startsWith(' ')) out += ' ';
    out += item.str;
    lastY = y;
  }
  return out
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/g, '') // control characters break the D1 import
    .replace(/[\ufb00-\ufb04]/g, (c) => ({ '\ufb00': 'ff', '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi', '\ufb04': 'ffl' })[c])
    .replace(/([a-zà-ú]) (ffi|ffl|fi|fl|ff) ([a-zà-ú])/g, '$1$2$3') // ligatures extracted as separate words
    .replace(/-\n(?=[a-zà-ú])/g, '')        // hyphenated line breaks
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Course PDFs carry the buyer's watermark (CPF + full name) and a header/footer on every page.
// Personal data never goes into the knowledge base, and repeated page furniture is noise.
const CPF_NAME = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b(\s*-\s*[A-ZÀ-Ú][A-Za-zÀ-ú'.]*(\s+[A-Za-zÀ-ú'.]+){0,8})?/g;
const NOISE_LINE = /(preparado exclusivamente para|^@\w+\s*$|licensed\s+to|marcelo\s*mapas|^resumo$|licenciado para|vedada, por quaisquer meios|reprodu[cç][aã]o, c[oó]pia, divulga|responsabiliza[cç][aã]o civil e criminal|voltar ao|^sum[aá]rio$|projeto lei em quest|livro eletr[oô]nico|www\.|https?:\/\/|\.com\.br|^\s*\d{1,4}\s*$|^\s*\d+\s*(de|\/)\s*\d+\s*$|estrat[eé]gia|gran cursos|^\s*autor(es)?\s*:|^\s*prof(a|essor|essora)?\.?\s+[A-ZÀ-Ú][a-zà-ú]+(\s+[A-ZÀ-Ú][a-zà-ú]+){0,3}\s*$)/i;
const cleanPages = (pages) => {
  const freq = new Map();
  for (const text of pages) for (const line of new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))) freq.set(line, (freq.get(line) || 0) + 1);
  const limit = Math.max(3, pages.length * 0.25);
  // The credits page near the start (publisher staff, copyright notice, tracking code, author bio) is dropped whole.
  return pages.map((text, i) => (i < 3 && /protegid[oa] por direitos autorais|diretor(a)? pedag[oó]gic|ato de pirataria|leia-o devagar, mas n[aã]o se preocupe/i.test(text) ? '' : text).split('\n')
    .map((line) => line.replace(CPF_NAME, '').replace(/==[0-9a-f]{4,}==/gi, '').replace(/[\w.+-]+@[\w-]+\.[a-z.]{2,}/gi, '').trim()) // tracking codes, e-mails
    // Question books repeat "Nível da questão", "Certo." and "Letra b." on most pages; they mark answers, not page furniture.
    .filter((line) => line && !NOISE_LINE.test(line) && ((freq.get(line) || 0) < limit || /^(N[ií]vel da quest|Certo\b|Errado\b|Letra\s+[a-e]\b)/i.test(line)))
    .join('\n'));
};

const chunkPages = (pages, firstPage = 1) => {
  // Joins pages, then cuts ~CHUNK chars at paragraph/sentence boundaries, remembering the page.
  const chunks = [];
  let buf = '';
  let bufPage = null;
  const flush = () => {
    const text = buf.trim();
    if (text.length > 80) chunks.push({ page: bufPage, text });
    buf = text.length > OVERLAP ? text.slice(-OVERLAP).replace(/^\S*\s/, '') : '';
  };
  pages.forEach((text, i) => {
    for (const para of text.split(/\n(?=[A-ZÀ-Ú§0-9IVXLC]|\s*Art\.)/)) {
      if (bufPage === null || !buf.trim()) bufPage = firstPage + i;
      if ((buf + '\n' + para).length > CHUNK && buf.length > CHUNK * 0.4) { flush(); bufPage = firstPage + i; }
      buf += (buf ? '\n' : '') + para;
      while (buf.length > CHUNK * 1.6) {
        const cut = buf.lastIndexOf('. ', CHUNK) > CHUNK * 0.5 ? buf.lastIndexOf('. ', CHUNK) + 1 : CHUNK;
        const head = buf.slice(0, cut);
        const rest = buf.slice(cut);
        buf = head; flush(); buf = (buf ? buf + ' ' : '') + rest.trim(); bufPage = firstPage + i;
      }
    }
  });
  flush();
  return chunks;
};


// Summaries with a table of contents ("Título ........ 17"): each entry opens a topic, and chunks never cross topics.
// Every chunk starts with its topic, which also makes the topic searchable. Entries are located by title inside the page
// text (page numbers in the table are only used to find where to look).
const TOC_ENTRY = /^(.{3,160}?)\s*(?:\.\s*){6,}\s*(\d{1,4})\s*$/;
const plain = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const parseToc = (rawPages) => {
  const entries = [];
  let pending = '';
  for (const raw of rawPages.slice(0, 8)) {
    if (!/sum[aá]rio|[ií]ndice/i.test(raw.slice(0, 600)) && !entries.length) continue;
    for (const line of raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
      const m = (pending ? `${pending} ${line}` : line).match(TOC_ENTRY);
      if (m) { entries.push({ title: m[1].replace(/[\s.]+$/, '').trim(), page: Number(m[2]) }); pending = ''; }
      else pending = /^(sum[aá]rio|[ií]ndice)$/i.test(line) || /Legisla[çc][ãa]o Esquematizada|^www\./i.test(line) || /^\d{1,3}$/.test(line) ? '' : (pending + ' ' + line).trim().slice(-200);
    }
  }
  // Only a real table: ascending pages, enough entries.
  const ok = entries.filter((e, i) => e.title.length >= 3 && e.page >= 1 && (i === 0 || e.page >= entries[i - 1].page));
  return ok.length >= 4 ? ok : [];
};
const tocPageCount = (rawPages, toc) => {
  let last = 0;
  rawPages.slice(0, 8).forEach((t, i) => { if (toc.some((e) => t.includes(e.title.slice(0, 20)) && /(?:\.\s*){6,}/.test(t))) last = i + 1; });
  return last;
};
const topicLabel = (title) => {
  const t = title.replace(/\s+/g, ' ').trim().replace(/\b(T[ií]tulo|Cap[ií]tulo|Se[cç][aã]o)\s+([IVXL]+)\b/gi, (_m, a, r) => `${a} ${r.toUpperCase()}`);
  return t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase()).replace(/\b(Do|Da|Dos|Das|De|E|Em|No|Na|Ao|A|O)\b(?!$)/g, (w, i) => (i === 0 ? w : w.toLowerCase())).replace(/\b([IVXL]{1,5})\b/gi, (w) => (/^[ivxl]+$/i.test(w) && /^[A-Z][a-z]*$/.test(w) ? w.toUpperCase() : w)) : t;
};

// Mind-map summaries ("Marcelomapas"): the table is a block of titles followed by "SUMÁRIO" and a block of page numbers
// printed twice ("06 06"), in the same order. Topics here start on a page, not on a text line.
const parseSplitToc = (rawPages) => {
  for (const raw of rawPages.slice(0, 5)) {
    const lines = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const at = lines.findIndex((l) => /^sum[aá]rio\s*sum[aá]rio$/i.test(l) || /^sum[aá]rio$/i.test(l));
    if (at < 1) continue;
    const titles = lines.slice(0, at).reduce((acc, l) => { if (acc.length && /[,\-–]$/.test(acc[acc.length - 1])) acc[acc.length - 1] += ` ${l}`; else acc.push(l); return acc; }, []);
    const nums = lines.slice(at + 1).map((l) => l.match(/^(\d{1,3})\s*\1$/) || l.match(/^(\d{1,3})$/)).filter(Boolean).map((m) => Number(m[1]));
    if (titles.length >= 4 && titles.length === nums.length) return Object.assign(titles.map((title, i) => ({ title, page: nums[i] })), { contentFrom: rawPages.indexOf(raw) + 1 });
  }
  return [];
};
const chunkByPages = (cleaned, toc, firstContentPage) => {
  const groups = [];
  for (const e of toc) {
    const last = groups[groups.length - 1];
    if (last && last.page === e.page) last.labels.push(topicLabel(e.title));
    else groups.push({ page: e.page, labels: [topicLabel(e.title)] });
  }
  const chunks = [];
  groups.forEach((g, i) => {
    const from = i === 0 ? firstContentPage : Math.max(g.page - 1, firstContentPage);
    const to = i + 1 < groups.length ? Math.max(groups[i + 1].page - 1, from + 1) : cleaned.length;
    for (const c of chunkPages(cleaned.slice(from, to), from + 1)) chunks.push({ page: c.page, text: `[${g.labels.join(' / ')}] ${c.text}` });
  });
  return chunks;
};
const chunkByToc = (cleaned, toc, firstContentPage) => {
  // Find the start (page index + line index) of each topic.
  const starts = [];
  let pageIdx = firstContentPage; let lineIdx = 0;
  for (const e of toc) {
    const key = plain(e.title);
    if (!key) continue;
    let found = null;
    for (let p = Math.max(e.page - 1, pageIdx); p < Math.min(cleaned.length, Math.max(e.page, pageIdx) + 6) && !found; p++) {
      const lines = cleaned[p].split('\n');
      for (let l = p === pageIdx ? lineIdx : 0; l < lines.length; l++) {
        const k = plain(lines[l]);
        if (k && (k === key || (k.length > 8 && key.startsWith(k) && k.length >= key.length * 0.6))) { found = { p, l }; break; }
      }
    }
    if (found) { starts.push({ label: topicLabel(e.title), ...found }); pageIdx = found.p; lineIdx = found.l + 1; }
  }
  if (process.env.DEBUG_TOC) console.error(`TOC ${toc.length} entradas, ${starts.length} localizadas; não achadas:`, toc.map((e) => e.title).filter((t) => !starts.some((s) => s.label === topicLabel(t))).slice(0, 12));
  if (starts.length < 3) return null;
  const chunks = [];
  starts.forEach((s, i) => {
    const end = starts[i + 1];
    const pages = [];
    for (let p = s.p; p <= (end ? end.p : cleaned.length - 1); p++) {
      let lines = cleaned[p].split('\n');
      if (p === (end ? end.p : -1)) lines = lines.slice(0, end.l);
      if (p === s.p) lines = lines.slice(s.l);
      pages.push(lines.join('\n'));
    }
    for (const c of chunkPages(pages, s.p + 1)) chunks.push({ page: c.page, text: `[${s.label}] ${c.text}` });
  });
  return chunks;
};

// "Lei em questões" books: each article followed by exam questions with the answer and a commentary.
// The useful part for the AI is the commentary tied to its article; options and the exam header are left out,
// and each question becomes one chunk: article, the point tested, the right answer and the explanation.
const isQuestionBook = (pages) => (pages.join('\n').match(/N[ií]vel da quest[aã]o/gi) || []).length >= 20;
const chunkQuestionBook = (pages, lawLabel) => {
  const chunks = [];
  const text = pages.map((p, i) => `\n<<P${i + 1}>>\n${p}`).join('\n');
  const sections = text.split(/\n(?=Artigo\s+\d+(?:-[A-Z])?\b)/);
  for (const section of sections) {
    const head = section.match(/^Artigo\s+(\d+(?:-[A-Z])?)\b[ \t]*\n?([^\n]*)/);
    if (!head) continue;
    const numero = head[1];
    const rubrica = /^Art\./.test(head[2]) ? '' : head[2].trim();
    const questions = section.split(/\n(?=\d{1,3}\.\s*\([^)]{3,120}\))/).slice(1);
    if (process.env.DEBUG_QB) console.error('SECAO', numero, questions.length);
    for (const q of questions) {
      const page = Number((section.slice(0, section.indexOf(q)).match(/<<P(\d+)>>/g) || ['<<P0>>']).pop().replace(/\D/g, '')) || null;
      const body = q.replace(/<<P\d+>>/g, ' ').replace(/^\d{1,3}\.\s*\([^)]*\)\s*/, '');
      // The "Nível da questão" label sometimes comes before the commentary in the PDF's text order: drop the label only.
      const clean = body.replace(/N[ií]vel da quest[aã]o\s*:?\s*(f[aá]cil|m[eé]dio|dif[ií]cil)?/gi, ' ').trim();
      const verdict = clean.match(/(?:^|\n)\s*(Certo|Errado)\b\.?/);
      const letter = clean.match(/(?:^|\n|\s)Letra\s+([a-e])\b\.?/i);
      const answerAt = verdict ? verdict.index : letter ? letter.index : -1;
      if (answerAt === -1) { if (process.env.DEBUG_QB) console.error('SEM RESPOSTA', numero, body.slice(0, 120).replace(/\n/g, ' | ')); continue; }
      const before = clean.slice(0, answerAt);
      const comment = clean.slice(answerAt).replace(/^\s*(Certo|Errado|Letra\s+[a-e])\b\.?\s*/i, '').replace(/\s+/g, ' ').trim();

      const optionRe = /\n\s*\(?([a-eA-E])[).]\s+([^\n]+(?:\n(?!\s*\(?[a-eA-E][).]\s)[^\n]+)*)/g;
      const options = {};
      for (const m of before.matchAll(optionRe)) options[m[1].toLowerCase()] = m[2].replace(/\s+/g, ' ').trim();
      const stem = before.replace(optionRe, ' ').replace(/\s+/g, ' ').trim();
      const answer = verdict ? `A afirmação está ${verdict[1].toLowerCase() === 'certo' ? 'correta' : 'incorreta'}.`
        : `Resposta correta: ${options[letter[1].toLowerCase()] || `letra ${letter[1]}`}.`;
      const where = `${lawLabel}, art. ${numero}${rubrica ? ` (${rubrica})` : ''}.`;
      // In some questions the PDF's text order puts the commentary before the answer: keep both together.
      const textOut = comment.length >= 60
        ? `${where} Ponto cobrado em prova: ${stem.slice(0, 500)} ${answer} Explicação: ${comment}`
        : `${where} Ponto cobrado em prova, com comentário: ${stem.slice(0, 1100)} ${answer}`;
      if (stem.length + comment.length < 80) continue;
      chunks.push({ page, text: textOut });
    }
  }
  return chunks;
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.pdf$/i.test(e.name) ? [p] : [];
});

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Upload bookkeeping: manifest.json lists the files already in D1 and the last id used, so later
// runs can send only new PDFs (the free D1 plan allows 100k written rows per day).
const readManifest = (dir) => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return { maxId: 0, hashes: [] }; }
};
const insertRows = (docs, firstId) => {
  const lines = [];
  let id = firstId - 1;
  for (const doc of docs) for (const c of doc.chunks) {
    id += 1;
    lines.push(`INSERT INTO fontes (id, doc, subject, page, text) VALUES (${id}, ${sqlString(doc.name)}, ${sqlString(doc.subject)}, ${c.page ?? 'NULL'}, ${sqlString(c.text)});`);
  }
  return { lines, lastId: id };
};

const commitDir = flag('--commit');
if (commitDir) {
  // Run after the SQL was imported successfully.
  fs.renameSync(path.join(commitDir, 'manifest.pending.json'), path.join(commitDir, 'manifest.json'));
  console.log('manifest atualizado');
  process.exit(0);
}

const sqlOut = flag('--sql');
const sqlNew = flag('--sql-new');
if (sqlOut || sqlNew) {
  const dir = sqlOut || sqlNew;
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'fontes.json'), 'utf8'));
  let lines;
  let docs;
  let manifest;
  if (sqlOut) {
    // Full rebuild: drops and recreates everything.
    docs = data.docs;
    const rows = insertRows(docs, 1);
    lines = [
      'DROP TABLE IF EXISTS fontes_fts;',
      'DROP TABLE IF EXISTS fontes;',
      'CREATE TABLE fontes (id INTEGER PRIMARY KEY, doc TEXT NOT NULL, subject TEXT NOT NULL, page INTEGER, text TEXT NOT NULL);',
      "CREATE VIRTUAL TABLE fontes_fts USING fts5(text, subject, doc, content='fontes', content_rowid='id', tokenize='unicode61 remove_diacritics 2');",
      ...rows.lines,
      "INSERT INTO fontes_fts(fontes_fts) VALUES('rebuild');",
    ];
    manifest = { maxId: rows.lastId, hashes: docs.map((d) => d.hash) };
  } else {
    // Incremental: only files whose content is not in D1 yet; the FTS index gets just the new rows.
    const known = readManifest(dir);
    const seen = new Set(known.hashes);
    docs = data.docs.filter((d) => !seen.has(d.hash));
    const rows = insertRows(docs, known.maxId + 1);
    lines = [
      ...rows.lines,
      `INSERT INTO fontes_fts(rowid, text, subject, doc) SELECT id, text, subject, doc FROM fontes WHERE id > ${known.maxId};`,
    ];
    manifest = { maxId: rows.lastId, hashes: [...known.hashes, ...docs.map((d) => d.hash)] };
  }
  const file = path.join(dir, sqlOut ? 'fontes.sql' : 'fontes-novos.sql');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'manifest.pending.json'), JSON.stringify(manifest));
  const chunks = docs.reduce((n, d) => n + d.chunks.length, 0);
  console.log(`SQL: ${docs.length} documento(s), ${chunks} trechos -> ${file}`);
  console.log(`Depois de importar no D1: node scripts/ingest-fontes.mjs --commit ${dir}`);
  process.exit(0);
}

const outDir = flag('--out');
if (!outDir || args.length === 0) {
  console.error('uso: node scripts/ingest-fontes.mjs --out <dir> <pasta> [<pasta>...]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const seen = new Map();
const docs = [];
const report = { files: 0, duplicates: [], scanned: [], failed: [] };
for (const root of args) {
  for (const file of walk(root)) {
    report.files += 1;
    const bytes = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(bytes).digest('hex');
    const name = path.basename(file).replace(/\.pdf$/i, '');
    if (seen.has(hash)) { report.duplicates.push(`${path.relative(root, file)} = ${seen.get(hash)}`); continue; }
    // Subject comes from the deepest meaningful folder ("PDF mpes/LEI ORGÂNICA DO MP" -> Lei Orgânica do MP).
    const parts = path.relative(path.dirname(root), file).split(path.sep).slice(0, -1).filter((p) => !/^(pdf\s*mpes|cf88)$/i.test(p));
    const folder = parts[parts.length - 1] || path.basename(root);
    seen.set(hash, name);
    try {
      const pdf = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 }).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) pages.push(await pageText(await pdf.getPage(i)));
      const chars = pages.reduce((n, t) => n + t.length, 0);
      const textPages = pages.filter((t) => t.length >= MIN_CHARS_PER_PAGE).length;
      if (textPages < pdf.numPages * 0.3) {
        report.scanned.push(`${folder}/${name} (${pdf.numPages} págs, ${chars} letras)`);
        continue;
      }
      const cleaned = cleanPages(pages);
      const toc = parseToc(pages);
      const splitToc = toc.length ? [] : parseSplitToc(pages);
      const chunks = isQuestionBook(cleaned) ? chunkQuestionBook(cleaned, /penal/i.test(name + folder) ? 'Código Penal' : subjectOf(folder)) : ((toc.length && chunkByToc(cleaned, toc, tocPageCount(pages, toc))) || (splitToc.length && chunkByPages(cleaned, splitToc, splitToc.contentFrom)) || chunkPages(cleaned));
      const esquem = name.match(/^(?:Quebrando Quest[õo]es|Marcelomapas) - (.+?)(?: - .+)? \((?:resumo )?esquematizado\)$/);
      const subject = /^Radegondes - /.test(name) ? subjectOf(folder) : esquem ? esquem[1] : /administrativo/i.test(name) ? 'Direito Administrativo' : /constitucional/i.test(name) ? 'Direito Constitucional'
        : /penal/i.test(name) && !/processo|processual/i.test(name) ? 'Direito Penal' : subjectOf(folder);
      docs.push({ name: `${subject} · ${name}`, subject, folder, hash, pages: pdf.numPages, chars, chunks });
      console.log(`✓ ${folder}/${name}: ${pdf.numPages} págs, ${chunks.length} trechos`);
    } catch (error) {
      report.failed.push(`${folder}/${name}: ${error.message}`);
    }
  }
}
fs.writeFileSync(path.join(outDir, 'fontes.json'), JSON.stringify({ createdAt: new Date().toISOString(), docs }));
const total = docs.reduce((n, d) => n + d.chunks.length, 0);
console.log(`\nArquivos lidos: ${report.files} | documentos únicos com texto: ${docs.length} | trechos: ${total}`);
console.log(`Repetidos (${report.duplicates.length}):\n  ${report.duplicates.join('\n  ') || '-'}`);
console.log(`Sem texto, provavelmente escaneados (${report.scanned.length}):\n  ${report.scanned.join('\n  ') || '-'}`);
console.log(`Falharam (${report.failed.length}):\n  ${report.failed.join('\n  ') || '-'}`);
