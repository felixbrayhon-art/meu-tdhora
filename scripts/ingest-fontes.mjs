// Builds the private study-material knowledge base the AI consults (alongside the law text).
// Reads PDFs from local folders, extracts text page by page, drops duplicate files, splits the
// text into chunks tagged with subject/file/page, and writes them to a JSON file. A second step
// (--sql) turns that JSON into SQL for the Cloudflare D1 database behind /api/fontes.
//
//   node scripts/ingest-fontes.mjs --out <dir> <folder> [<folder> ...]
//   node scripts/ingest-fontes.mjs --sql <dir>
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
  .replace(/\bEs\b/, 'ES').replace(/\bMp\b/, 'MP').replace(/^Lrf$/, 'Lei de Responsabilidade Fiscal') || 'Geral';

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
const NOISE_LINE = /(www\.|https?:\/\/|\.com\.br|^\s*\d{1,4}\s*$|^\s*\d+\s*(de|\/)\s*\d+\s*$)/i;
const cleanPages = (pages) => {
  const freq = new Map();
  for (const text of pages) for (const line of new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))) freq.set(line, (freq.get(line) || 0) + 1);
  const limit = Math.max(3, pages.length * 0.25);
  return pages.map((text) => text.split('\n')
    .map((line) => line.replace(CPF_NAME, '').replace(/==[0-9a-f]{4,}==/gi, '').trim()) // buyer tracking codes
    .filter((line) => line && !NOISE_LINE.test(line) && (freq.get(line) || 0) < limit)
    .join('\n'));
};

const chunkPages = (pages) => {
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
      if (bufPage === null || !buf.trim()) bufPage = i + 1;
      if ((buf + '\n' + para).length > CHUNK && buf.length > CHUNK * 0.4) { flush(); bufPage = i + 1; }
      buf += (buf ? '\n' : '') + para;
      while (buf.length > CHUNK * 1.6) {
        const cut = buf.lastIndexOf('. ', CHUNK) > CHUNK * 0.5 ? buf.lastIndexOf('. ', CHUNK) + 1 : CHUNK;
        const head = buf.slice(0, cut);
        const rest = buf.slice(cut);
        buf = head; flush(); buf = (buf ? buf + ' ' : '') + rest.trim(); bufPage = i + 1;
      }
    }
  });
  flush();
  return chunks;
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.pdf$/i.test(e.name) ? [p] : [];
});

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;

const sqlOut = flag('--sql');
if (sqlOut) {
  const data = JSON.parse(fs.readFileSync(path.join(sqlOut, 'fontes.json'), 'utf8'));
  const lines = [
    'DROP TABLE IF EXISTS fontes_fts;',
    'DROP TABLE IF EXISTS fontes;',
    'CREATE TABLE fontes (id INTEGER PRIMARY KEY, doc TEXT NOT NULL, subject TEXT NOT NULL, page INTEGER, text TEXT NOT NULL);',
    "CREATE VIRTUAL TABLE fontes_fts USING fts5(text, subject, doc, content='fontes', content_rowid='id', tokenize='unicode61 remove_diacritics 2');",
  ];
  let id = 0;
  for (const doc of data.docs) for (const c of doc.chunks) {
    id += 1;
    lines.push(`INSERT INTO fontes (id, doc, subject, page, text) VALUES (${id}, ${sqlString(doc.name)}, ${sqlString(doc.subject)}, ${c.page ?? 'NULL'}, ${sqlString(c.text)});`);
  }
  lines.push("INSERT INTO fontes_fts(fontes_fts) VALUES('rebuild');");
  fs.writeFileSync(path.join(sqlOut, 'fontes.sql'), lines.join('\n') + '\n');
  console.log(`SQL: ${id} trechos -> ${path.join(sqlOut, 'fontes.sql')}`);
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
      const chunks = chunkPages(cleanPages(pages));
      const subject = /administrativo/i.test(name) ? 'Direito Administrativo' : /constitucional/i.test(name) ? 'Direito Constitucional' : subjectOf(folder);
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
