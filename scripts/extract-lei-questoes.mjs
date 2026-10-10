// Turns a "lei em questão" book (exam questions grouped by law article, each followed by its answer and a
// teacher's commentary) into question-bank drafts in the JSON format worker/scripts/push_drafts.py reads.
//
//   node scripts/extract-lei-questoes.mjs <livro.pdf> --law codigo-penal --subject "Direito Penal" --out drafts.json
//
// Only the exam question itself (banca, órgão, cargo, ano, enunciado, alternativas, gabarito) is kept. The
// commentary belongs to the course and is never copied: the explanation is the official article text from
// public/vademecum. Questions whose layout is ambiguous get a warning and wait for review in the admin screen.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const pdfPath = args.find((a) => a.endsWith('.pdf'));
const lawId = opt('law');
const subject = opt('subject');
const outPath = opt('out');
if (!pdfPath || !lawId || !subject || !outPath) {
  console.error('uso: node scripts/extract-lei-questoes.mjs <livro.pdf> --law <id do vade mecum> --subject "<matéria>" --out <drafts.json>');
  process.exit(1);
}
const LAW_LABELS = Object.fromEntries(
  [...fs.readFileSync('types.ts', 'utf8').matchAll(/\{ id: '([^']+)', name: '([^']+)'/g)].map((m) => [m[1], m[2]]),
);
const lawLabel = LAW_LABELS[lawId] ?? lawId;
const lawArticles = JSON.parse(fs.readFileSync(path.join('public/vademecum', `${lawId}.json`), 'utf8'));

// ---- Lines with their indentation: question text is indented (x ≈ 79), answer and commentary are not (x ≈ 57).
const readLines = async (file) => {
  const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 }).promise;
  const all = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();
    const height = page.view[3];
    const lines = [];
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5];
      if (y > height - 70 || y < 62) continue; // running header, licence footer, page number
      let line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!line) lines.push((line = { y, x: it.transform[4], parts: [] }));
      line.x = Math.min(line.x, it.transform[4]);
      line.parts.push({ x: it.transform[4], str: it.str });
    }
    lines.sort((a, b) => b.y - a.y);
    for (const l of lines) all.push({ page: n, x: Math.round(l.x), text: l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join('').replace(/\s+/g, ' ').trim() });
  }
  return all;
};

// Words split across lines ("legali-" + "dade") are joined back.
const joinLines = (lines) => lines.map((l) => l.text).reduce((acc, t) => (/[a-zà-ú]-$/i.test(acc) ? acc.slice(0, -1) + t : acc ? `${acc} ${t}` : t), '').trim();

const HEADER = /^(\d{1,3})\.\s*\(([^)]{3,160})\)\s*(.*)$/;
const ARTICLE = /^Artigo\s+(\d+)\s*[°ºo]?(?:\s*-\s*([A-Z]))?\b/;
const VERDICT = /^(Certo|Errado)\.?$/;
const LETTER = /^Letra\s+([a-e])\.?$/i;
const OPTION = /^([a-e])[.)]\s*(.*)$/;
const LEVEL = /^N[ií]vel da quest[aã]o/i;

const parseSource = (raw) => {
  const adapted = /ADAPTAD/i.test(raw);
  const clean = raw.replace(/[-\s]*ADAPTAD[AO]S?/gi, '').split('/').map((p) => p.trim()).filter(Boolean);
  const yearAt = clean.findIndex((p) => /^(19|20)\d{2}$/.test(p));
  const year = yearAt >= 0 ? Number(clean[yearAt]) : null;
  const rest = clean.filter((_, i) => i !== yearAt);
  return { board: rest[0] ?? null, organization: rest[1] ?? null, position: rest.slice(2).join(' / ') || null, year, adapted };
};

// "Julgue os itens" stems carry no assertion of their own: in these books the item is sometimes printed after the
// answer, mixed with the commentary, so it cannot be told apart safely.
const NEEDS_ITEM = /julgue (o|os) (item|itens)[^.]*\.?\s*$|julgue (o|os) (item|itens) (a seguir|subsequente|que se segue)/i;
// Commentary sometimes sits inside the question box, before the answer.
const COMMENT_START = /^(A questão|Questão|O examinador|Conforme|De acordo com|Segundo|Nos termos|Trata-se|Item|Gabarito|Correto|Correta|Errado|Incorret|Exatamente|Perfeito|Isso mesmo|Cuidado|Atenção|Lembre|Observe|Veja|Temos|Aqui|Na verdade|Pelo contrário|Ao contrário|Não\b|Está|É o que)/;

const articleText = (numero) => {
  const art = lawArticles.find((a) => a.numero === numero);
  if (!art) return null;
  return art.texto.replace(/^.*?(?=\bArt\.\s*\d)/, '').replace(/\s+/g, ' ').trim();
};

const lines = await readLines(pdfPath);
const questions = [];
const report = { total: 0, warnings: {} };
// q: { source, first, body: lines (stem + options), verdict | letter, page, article, layout }
const build = (q) => {
  report.total++;
  const warnings = [];
  const src = parseSource(q.source);
  const stemLines = [];
  const options = [];
  if (q.layout === 'lista') {
    // Options may share a line ("c) … d) …"): find a) b) c) … in order inside the joined text.
    const text = joinLines([{ text: q.first }, ...q.body]);
    const cuts = [];
    let from = 0;
    for (const letter of 'abcde') {
      const re = new RegExp(`(?:^|\\s)${letter}\\)\\s`, 'g');
      re.lastIndex = from;
      const m = re.exec(text);
      if (!m) break;
      cuts.push({ letter, at: m.index, start: m.index + m[0].length });
      from = m.index + m[0].length;
    }
    if (cuts.length >= 2) {
      q.first = text.slice(0, cuts[0].at);
      q.body = [];
      cuts.forEach((c, i) => options.push({ letter: c.letter, lines: [{ text: text.slice(c.start, i + 1 < cuts.length ? cuts[i + 1].at : undefined).trim() }] }));
    }
  }
  for (const l of q.body) {
    const m = l.text.match(OPTION);
    if (m && l.x <= 85 && (options.length > 0 ? m[1].charCodeAt(0) === options[options.length - 1].letter.charCodeAt(0) + 1 : m[1] === 'a')) options.push({ letter: m[1], lines: [{ ...l, text: m[2] }] });
    else if (options.length > 0) options[options.length - 1].lines.push(l);
    else stemLines.push(l);
  }
  let statement = joinLines([{ text: q.first }, ...stemLines]);
  let alternatives;
  let correctLetter;
  let questionType;
  if (q.verdict) {
    questionType = 'certo_errado';
    correctLetter = q.verdict === 'Certo' ? 'C' : 'E';
    alternatives = [{ letter: 'C', text: 'Certo' }, { letter: 'E', text: 'Errado' }];
    if (options.length > 0) warnings.push('certo/errado com alternativas no enunciado');
    if (q.layout === 'por-artigo' && NEEDS_ITEM.test(statement)) warnings.push('o item julgado pode ter ficado fora do enunciado (layout do livro)');
    const sentences = stemLines.map((l, i) => (i > 0 && /[.:;?]$/.test(stemLines[i - 1].text) && COMMENT_START.test(l.text) ? i : -1)).filter((i) => i >= 0);
    if (q.layout === 'por-artigo' && sentences.length > 0) warnings.push('comentário do professor pode estar misturado ao enunciado');
  } else if (q.letter) {
    questionType = 'multipla_escolha';
    correctLetter = q.letter.toUpperCase();
    alternatives = options.map((o) => ({ letter: o.letter.toUpperCase(), text: joinLines(o.lines) }));
    if (alternatives.length < 2) warnings.push('alternativas não encontradas');
    if (!alternatives.some((a) => a.letter === correctLetter)) warnings.push('gabarito não corresponde a nenhuma alternativa');
    const last = alternatives[alternatives.length - 1];
    if (last && last.text.length > 400) warnings.push('última alternativa muito longa: pode conter comentário');
  } else {
    warnings.push('gabarito não encontrado');
    questionType = 'multipla_escolha';
    alternatives = [];
    correctLetter = null;
  }
  if (src.adapted) warnings.push('questão adaptada pelo autor do livro: conferir antes de publicar');
  statement = statement.replace(/\s+/g, ' ').trim();

  const numero = q.article;
  const cited = (q.articles?.length ? q.articles : numero ? [numero] : []).filter((n) => articleText(n));
  const official = cited.length ? cited.map((n) => articleText(n)).join(' ') : null;
  const answerText = questionType === 'certo_errado' ? (correctLetter === 'C' ? 'Certo' : 'Errado') : `Letra ${correctLetter}`;
  const perArticle = Math.floor(2500 / Math.max(1, cited.length));
  const explanation = official
    ? `Gabarito: ${answerText}.\n\nFundamento legal — ${lawLabel}:\n${cited.map((n) => { const t = articleText(n); return t.length > perArticle ? `${t.slice(0, perArticle)}…` : t; }).join('\n\n')}`
    : '';
  if (!official) warnings.push('artigo da lei não localizado no Vade Mecum');
  // A gabarito from before a change to the article may no longer hold ("Redação dada pela Lei nº 15.397, de 2026").
  const changedIn = official ? [...official.matchAll(/(?:Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Revogad[oa]|Vide)\b[^)]*?\b(?:de|em)\s+(?:\d{1,2}[./]\d{1,2}[./])?((?:19|20)\d{2})\)/gi)].map((m) => Number(m[1])) : [];
  const lastChange = Math.max(0, ...changedIn);
  if (src.year && lastChange > src.year) warnings.push(`artigo alterado em ${lastChange}, depois da prova (${src.year}): conferir se o gabarito continua valendo`);

  for (const w of warnings) { const key = w.replace(/\d{4}/g, 'AAAA'); report.warnings[key] = (report.warnings[key] || 0) + 1; }
  const hash = crypto.createHash('sha256').update(statement.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()).digest('hex');
  questions.push({
    source: 'lei_em_questao',
    externalId: `${lawId}-${hash.slice(0, 16)}`,
    number: questions.length + 1,
    questionType,
    subjectRaw: subject,
    topicRaw: numero ? `${lawLabel} — art. ${numero}` : lawLabel,
    importSubject: subject,
    importYear: src.year,
    statement,
    alternatives: alternatives.map((a, i) => ({ ...a, isCorrect: a.letter === correctLetter, position: i })),
    correctLetter,
    explanation,
    sourcePage: q.page,
    contentHash: hash,
    status: warnings.length ? 'needs_attention' : 'pending_review',
    warnings,
    examYear: src.year,
    examBoard: src.board,
    organization: src.organization,
    position: src.position,
    originalQuestionNumber: null,
    sourceDescription: [src.board, src.organization, src.position, src.year].filter(Boolean).join(' / ') + (src.adapted ? ' (adaptada)' : ''),
    lawId,
    lawArticle: numero,
  });
};

// Layout 1 ("lei em questão" books): questions under each "Artigo N" heading, each followed by its answer.
const parseByArticle = () => {
let article = null;
let current = null;
const finish = () => { if (current) build(current); current = null; };
for (const line of lines) {
  const art = line.text.match(ARTICLE);
  if (art && line.x < 79) {
    finish();
    article = art[2] ? `${art[1]}-${art[2]}` : art[1];
    continue;
  }
  const head = line.text.match(HEADER);
  if (head && line.x <= 55) {
    finish();
    current = { source: head[2], first: head[3], body: [], verdict: null, letter: null, page: line.page, article, layout: 'por-artigo' };
    continue;
  }
  if (!current) continue;
  if (current.verdict || current.letter) {
    continue; // answer already given: what follows is commentary or law text until the next question
  }
  const v = line.text.match(VERDICT);
  const l = line.text.match(LETTER);
  if (v && line.x < 70) { current.verdict = v[1]; continue; }
  if (l && line.x < 70) { current.letter = l[1]; continue; }
  if (LEVEL.test(line.text)) continue;
  if (line.x >= 70) current.body.push(line); // unindented text before the answer is commentary
}
finish();
};

// Layout 2 (apostilas): a "Questões de concurso" list, a "Gabarito" (1.C, 11.d …) and a "Gabarito comentado" that
// quotes the article each question rests on. Only the article number is taken from it, after checking that the
// quoted wording matches the official text.
// "016.016.NC-UFPR/…)" — the book sometimes drops the opening parenthesis.
const LIST_HEADER = /^0*(\d{1,3})\.\s*0*\d{1,3}\.\s*\(?([^()]{3,160}\/[^()]{2,160})\)\s*(.*)$/;
const parseList = () => {
  const at = (re, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l.text));
  const qStart = at(/^QUEST[ÕO]ES DE CONCURSO/i);
  const gStart = at(/^GABARITO(GABARITO)?$/i, qStart);
  const cStart = at(/^GABARITO COMENTADO/i, gStart);
  if (qStart < 0 || gStart < 0) return false;
  const answers = {};
  for (const l of lines.slice(gStart, cStart < 0 ? undefined : cStart)) {
    const m = l.text.match(/^(\d{1,3})\.\s*([CEce]|[a-e])\.?$/);
    if (m) answers[Number(m[1])] = m[2];
  }
  const split = (from, to) => {
    const out = [];
    for (const l of lines.slice(from, to)) {
      const m = l.text.match(LIST_HEADER);
      if (m) out.push({ n: Number(m[1]), source: m[2], first: m[3], page: l.page, body: [] });
      else if (out.length) out[out.length - 1].body.push(l);
    }
    return out;
  };
  const commented = new Map(cStart < 0 ? [] : split(cStart, lines.length).map((q) => [q.n, q.body]));
  for (const q of split(qStart, gStart)) {
    const answer = answers[q.n];
    const articles = [];
    for (const l of commented.get(q.n) ?? []) {
      const m = l.text.match(/^Art\.\s*(\d+)\s*[ºo°]?(?:-([A-Z]))?\.?\s*(.*)$/);
      if (!m || l.x < 80) continue;
      const numero = m[2] ? `${m[1]}-${m[2]}` : m[1];
      // PDF text drops some spaces ("nesta Leisão"): compare without them.
      const quoted = norm(m[3]).replace(/ /g, '').slice(0, 30);
      const official = articleText(numero);
      if (official && !articles.includes(numero) && (quoted.length < 8 || /^\[/.test(m[3].trim()) || norm(official).replace(/ /g, '').includes(quoted))) articles.push(numero);
    }
    // Commentary that names the article in prose ("previstos no art. 4º da Lei de Abuso de Autoridade", "em seu
    // art. 5º"): accepted only when the citation clearly points at this law, never at another code.
    if (articles.length === 0) {
      const prose = joinLines(commented.get(q.n) ?? []);
      const lawName = /^(da|desta|na|nesta)\s+(lei\b(?!\s+n?\.?\s*\d)(?!\s+(?:complementar|org[aâ]nica))|lei\s+n?[º°.]?\s*13\.?869|lei de abuso)/i;
      for (const m of prose.matchAll(/(em seu\s+)?\bart\.\s*(\d+)\s*[ºo°]?(?:-([A-Z]))?/gi)) {
        const numero = m[3] ? `${m[2]}-${m[3]}` : m[2];
        const after = prose.slice(m.index + m[0].length).replace(/^[,\s]*(?:(?:§|inciso|caput|par[aá]grafo)[^,]{0,25},?\s*)*/i, '');
        if ((m[1] || lawName.test(after)) && articleText(numero) && !articles.includes(numero)) articles.push(numero);
      }
    }
    build({ ...q, body: q.body, articles, verdict: /^[CE]$/.test(answer ?? '') ? (answer === 'C' ? 'Certo' : 'Errado') : null, letter: /^[a-e]$/.test(answer ?? '') ? answer : null, article: articles[0] ?? null, layout: 'lista' });
  }
  return true;
};
const norm = (t) => (t ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

if (!parseList()) parseByArticle();

const years = new Set(questions.map((q) => q.examYear).filter(Boolean));
const payload = {
  meta: {
    title: `Lei em questão — ${lawLabel}`,
    ownerName: null,
    ownerEmail: null,
    generatedAt: new Date().toISOString(),
    bloco: `${lawLabel} — ${questions.length} questões (${[...years].sort().slice(0, 1).concat([...years].sort().slice(-1)).join('–')})`,
  },
  questions,
};
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
const flagged = questions.filter((q) => q.warnings.length).length;
console.log(`${path.basename(pdfPath)}: ${questions.length} questões (${questions.filter((q) => q.questionType === 'certo_errado').length} certo/errado, ${questions.filter((q) => q.questionType === 'multipla_escolha').length} múltipla escolha)`);
console.log(`  prontas para revisão: ${questions.length - flagged} | precisam de atenção: ${flagged}`);
for (const [w, n] of Object.entries(report.warnings).sort((a, b) => b[1] - a[1])) console.log(`    ${n}× ${w}`);
console.log(`  → ${outPath}`);
