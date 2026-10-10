// Loads FC Concursos flashcards (pergunta + resposta comentada) into the D1 database bound as FONTES, table
// `flashcards`, where functions/api/flashcard-questions.ts turns them into multiple-choice questions on demand.
//
// Input: the FC "Exportar PDF" print pages saved with Cmd+S as HTML (one file per block of 300 cards), or JSON
// arrays of cards. Cards already in the database (same FC number) are skipped.
//
//   node scripts/ingest-flashcards.mjs ~/fontes-todahora/fc/*.html            (parse + write flashcards.sql)
//   node scripts/ingest-flashcards.mjs ~/fontes-todahora/fc/*.html --upload   (also send it to Cloudflare D1)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const files = args.filter((a) => /\.(html?|json)$/i.test(a));
const upload = args.includes('--upload');
const outPath = path.join(path.dirname(path.resolve(files[0] ?? '.')), 'flashcards.sql');
if (files.length === 0) {
  console.error('uso: node scripts/ingest-flashcards.mjs <arquivos .html ou .json> [--upload]');
  process.exit(1);
}

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°', ndash: '–', mdash: '—', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', middot: '·', bull: '•' };
const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

// Close to the browser's innerText: block elements end a line, everything else is inline.
const htmlToText = (html) => decodeEntities(html
  .replace(/<(script|style|head|noscript)[\s\S]*?<\/\1>/gi, '')
  .replace(/<a\b[^>]*href="([^"]+)"[^>]*>\s*<\/a>/gi, ' $1 ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|h\d|li|tr|section|article|header|footer)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n• ')
  .replace(/<[^>]+>/g, ''))
  .split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).join('\n')
  .replace(/\n{3,}/g, '\n\n');

// "1 · FC #69353 / Matéria: … / Assunto: … / <pergunta> / Resposta: … / Veja como foi cobrado: <link> / <comentário>"
const parseCards = (text) => text.split(/\n(?=\d{1,4}\s*·\s*FC #\d+\s*\n)/).slice(1).map((part) => {
  const m = part.match(/^(\d+)\s*·\s*FC #(\d+)\s*\nMatéria:\s*(.*)\nAssunto:\s*(.*)\n([\s\S]*)$/);
  if (!m) return null;
  const body = m[5];
  const at = body.indexOf('\nResposta:');
  if (at < 0) return null;
  const pergunta = body.slice(0, at).replace(/^De acordo com o assunto[^\n]*\n+/, '').trim();
  const rest = body.slice(at + '\nResposta:'.length);
  const seen = rest.indexOf('Veja como foi cobrado:');
  const resposta = (seen >= 0 ? rest.slice(0, seen) : rest).trim();
  const after = seen >= 0 ? rest.slice(seen) : '';
  const link = (after.match(/https:\/\/\S+/) || [''])[0];
  // The page footer (© FC Concursos · name · e-mail · date) sticks to the last card: never keep it.
  const comentario = after.replace(/^Veja como foi cobrado:\s*\S*\s*/, '').replace(/©\s*FC Concursos[\s\S]*$/, '').trim();
  return { fc: m[2], materia: m[3].trim(), assunto: m[4].trim(), pergunta, resposta, comentario, link };
}).filter((c) => c && c.pergunta && c.resposta);

const cards = new Map();
const PERSONAL = /©\s*FC Concursos|[\w.+-]+@[\w-]+\.[a-z.]{2,}|Gerado em \d/i;
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const list = (/\.json$/i.test(file) ? JSON.parse(raw) : parseCards(htmlToText(raw)))
    .map((c) => ({ ...c, comentario: PERSONAL.test(c.comentario || '') ? '' : c.comentario }))
    .filter((c) => !PERSONAL.test(`${c.pergunta} ${c.resposta}`));
  for (const c of list) cards.set(String(c.fc), c);
  console.log(`${path.basename(file)}: ${list.length} cards`);
}

const sqlString = (v) => (v ? `'${String(v).replace(/'/g, "''")}'` : 'NULL');
const sql = [
  'CREATE TABLE IF NOT EXISTS flashcards (id INTEGER PRIMARY KEY, fc TEXT NOT NULL UNIQUE, materia TEXT, assunto TEXT, pergunta TEXT NOT NULL, resposta TEXT NOT NULL, comentario TEXT, link TEXT);',
  "CREATE VIRTUAL TABLE IF NOT EXISTS flashcards_fts USING fts5(assunto, materia, pergunta, resposta, content='flashcards', content_rowid='id', tokenize='unicode61 remove_diacritics 2');",
  "CREATE TRIGGER IF NOT EXISTS flashcards_ai AFTER INSERT ON flashcards BEGIN INSERT INTO flashcards_fts(rowid, assunto, materia, pergunta, resposta) VALUES (new.id, new.assunto, new.materia, new.pergunta, new.resposta); END;",
  ...[...cards.values()].map((c) => `INSERT OR IGNORE INTO flashcards (fc, materia, assunto, pergunta, resposta, comentario, link) VALUES (${[c.fc, c.materia, c.assunto, c.pergunta, c.resposta, c.comentario, c.link].map(sqlString).join(', ')});`),
].join('\n');
fs.writeFileSync(outPath, `${sql}\n`);
const byMateria = {};
for (const c of cards.values()) byMateria[c.materia] = (byMateria[c.materia] || 0) + 1;
console.log(`\n${cards.size} cards únicos → ${outPath}`);
for (const [m, n] of Object.entries(byMateria).sort((a, b) => b[1] - a[1])) console.log(`  ${n}  ${m}`);

if (upload) {
  console.log('\n☁️  Enviando para o Cloudflare D1…');
  execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'todahora-fontes', '--remote', '--file', outPath, '--yes'], { stdio: 'inherit' });
}
