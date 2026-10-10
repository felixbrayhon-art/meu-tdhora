// Loads commented multiple-choice questions (extracted from PDFs by ~/fontes-todahora/extract_*.py) into the D1 database
// bound as FONTES, table `questoes_comentadas`, which functions/api/questoes-comentadas.ts serves to the app.
// A question is kept only with a statement, exactly five options (A–E), a key that is one of them and a comment.
//
//   node scripts/ingest-questoes-comentadas.mjs [dir]            (parse + write SQL chunks next to the JSON files)
//   node scripts/ingest-questoes-comentadas.mjs [dir] --upload   (also send them to Cloudflare D1)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(os.homedir(), 'fontes-todahora', 'comentadas'));
const upload = args.includes('--upload');
const outDir = path.join(dir, 'sql');
fs.mkdirSync(outDir, { recursive: true });

// Contact data of whoever downloaded the PDF must never reach the database.
const PERSONAL = /[\w.+-]+@[\w-]+\.[a-z.]{2,}|\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|©\s*FC Concursos|Gerado em \d|Material Exclusivo/i;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const fonteOf = (arquivo) => arquivo.replace(/\.pdf\.json$/i, '').replace(/^fc_/, '').replace(/\(Comentado\)\s*/i, '').replace(/\s*-\s*Projeto Caveira/i, '').trim();

const seen = new Map();
let total = 0, dropped = 0;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const q of data.questoes ?? []) {
    total++;
    const letters = Object.keys(q.alternativas ?? {});
    const ok = letters.join('') === 'ABCDE' && letters.includes(q.gabarito) && q.enunciado?.length >= 25 && q.comentario?.length >= 20
      && !PERSONAL.test(`${q.enunciado} ${Object.values(q.alternativas).join(' ')} ${q.comentario}`);
    if (!ok) { dropped++; continue; }
    const key = crypto.createHash('sha1').update(norm(q.enunciado)).digest('hex');
    if (!seen.has(key)) seen.set(key, { ...q, key, fonte: fonteOf(data.arquivo ?? file) });
  }
}

const sqlString = (v) => (v ? `'${String(v).replace(/'/g, "''")}'` : 'NULL');
const header = [
  'CREATE TABLE IF NOT EXISTS questoes_comentadas (id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, fonte TEXT, materia TEXT, assunto TEXT, enunciado TEXT NOT NULL, alternativas TEXT NOT NULL, gabarito TEXT NOT NULL, comentario TEXT NOT NULL);',
  "CREATE VIRTUAL TABLE IF NOT EXISTS questoes_comentadas_fts USING fts5(assunto, materia, enunciado, comentario, content='questoes_comentadas', content_rowid='id', tokenize='unicode61 remove_diacritics 2');",
  'CREATE TRIGGER IF NOT EXISTS questoes_comentadas_ai AFTER INSERT ON questoes_comentadas BEGIN INSERT INTO questoes_comentadas_fts(rowid, assunto, materia, enunciado, comentario) VALUES (new.id, new.assunto, new.materia, new.enunciado, new.comentario); END;',
];
const rows = [...seen.values()].map((q) => `INSERT OR IGNORE INTO questoes_comentadas (hash, fonte, materia, assunto, enunciado, alternativas, gabarito, comentario) VALUES (${[q.key, q.fonte, q.materia, q.assunto, q.enunciado, JSON.stringify(q.alternativas), q.gabarito, q.comentario].map(sqlString).join(', ')});`);
const CHUNK = 150;
const files = [];
for (let i = 0; i < rows.length; i += CHUNK) {
  const f = path.join(outDir, `questoes-${String(i / CHUNK).padStart(3, '0')}.sql`);
  fs.writeFileSync(f, `${(i === 0 ? header : []).concat(rows.slice(i, i + CHUNK)).join('\n')}\n`);
  files.push(f);
}
console.log(`${total} lidas, ${dropped} descartadas (sem 5 alternativas/gabarito/comentário ou com dado pessoal), ${seen.size} únicas → ${files.length} arquivo(s) em ${outDir}`);

if (upload) {
  console.log('\n☁️  Enviando para o Cloudflare D1…');
  for (const f of files) execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'todahora-fontes', '--remote', '--file', f, '--yes'], { stdio: 'inherit' });
}
