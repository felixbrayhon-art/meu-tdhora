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
import { classify } from './lib/disciplinas.mjs';
import { semCaveira } from './lib/limpar.mjs';

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(os.homedir(), 'fontes-todahora', 'comentadas'));
const upload = args.includes('--upload');
const outDir = path.join(dir, 'sql');
fs.mkdirSync(outDir, { recursive: true });

// Contact data of whoever downloaded the PDF must never reach the database.
const PERSONAL = /[\w.+-]+@[\w-]+\.[a-z.]{2,}|\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}|©\s*FC Concursos|Gerado em \d|Material Exclusivo/i;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const fonteOf = (arquivo) => semCaveira(arquivo.replace(/\.pdf\.json$/i, '').replace(/\.pdf$/i, '').replace(/^fc_/, '').replace(/\(Comentado\)\s*/i, '').replace(/\s*-\s*Projeto Caveira/i, '').trim());

let total = 0, dropped = 0;
// Discipline of each question: keyword score, then (1) the FC "matéria" votes, (2) the neighbours in the same simulado
// (the Caveira simulados come in blocks by discipline).
const mode = (list) => { const c = {}; for (const x of list) c[x] = (c[x] || 0) + 1; const e = Object.entries(c).sort((a, b) => b[1] - a[1]); return e.length ? { name: e[0][0], n: e[0][1], total: list.length } : null; };
const perFile = [];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const kept = [];
  for (const q of data.questoes ?? []) {
    total++;
    const letters = Object.keys(q.alternativas ?? {});
    const ok = letters.join('') === 'ABCDE' && letters.includes(q.gabarito) && q.enunciado?.length >= 25 && q.comentario?.length >= 20
      && !PERSONAL.test(`${q.enunciado} ${Object.values(q.alternativas).join(' ')} ${q.comentario}`);
    if (!ok) { dropped++; continue; }
    kept.push({ ...q, enunciado: semCaveira(q.enunciado), comentario: semCaveira(q.comentario), fonte: fonteOf(data.arquivo ?? file), disciplina: classify(q) });
  }
  perFile.push(kept);
}
const byMateria = {};
for (const q of perFile.flat()) if (q.materia && q.disciplina !== 'Outras') (byMateria[q.materia] ??= []).push(q.disciplina);
const materiaVote = new Map();
for (const [m, list] of Object.entries(byMateria)) { const v = mode(list); if (v && v.total >= 3 && v.n / v.total >= 0.6) materiaVote.set(m, v.name); }
for (const kept of perFile) {
  for (const q of kept) if (q.materia && materiaVote.has(q.materia)) q.disciplina = materiaVote.get(q.materia);
  kept.forEach((q, i) => {
    if (q.disciplina !== 'Outras' || q.materia) return;
    const near = kept.slice(Math.max(0, i - 4), i + 5).filter((x) => x !== q && x.disciplina !== 'Outras').map((x) => x.disciplina);
    const v = mode(near);
    if (v && v.n >= 3 && v.n / v.total > 0.5) q.disciplina = v.name;
  });
}
const seen = new Map();
for (const q of perFile.flat()) {
  const key = crypto.createHash('sha1').update(norm(q.enunciado)).digest('hex');
  if (!seen.has(key)) seen.set(key, { ...q, key });
}

const sqlString = (v) => (v ? `'${String(v).replace(/'/g, "''")}'` : 'NULL');
const header = [
  'DROP TRIGGER IF EXISTS questoes_comentadas_ai;',
  'DROP TABLE IF EXISTS questoes_comentadas_fts;',
  'DROP TABLE IF EXISTS questoes_comentadas;',
  'CREATE TABLE IF NOT EXISTS questoes_comentadas (id INTEGER PRIMARY KEY, hash TEXT NOT NULL UNIQUE, fonte TEXT, disciplina TEXT, materia TEXT, assunto TEXT, enunciado TEXT NOT NULL, alternativas TEXT NOT NULL, gabarito TEXT NOT NULL, comentario TEXT NOT NULL);',
  "CREATE VIRTUAL TABLE IF NOT EXISTS questoes_comentadas_fts USING fts5(assunto, materia, enunciado, comentario, content='questoes_comentadas', content_rowid='id', tokenize='unicode61 remove_diacritics 2');",
  'CREATE TRIGGER IF NOT EXISTS questoes_comentadas_ai AFTER INSERT ON questoes_comentadas BEGIN INSERT INTO questoes_comentadas_fts(rowid, assunto, materia, enunciado, comentario) VALUES (new.id, new.assunto, new.materia, new.enunciado, new.comentario); END;',
];
const rows = [...seen.values()].map((q) => `INSERT OR IGNORE INTO questoes_comentadas (hash, fonte, disciplina, materia, assunto, enunciado, alternativas, gabarito, comentario) VALUES (${[q.key, q.fonte, q.disciplina, q.materia, q.assunto, q.enunciado, JSON.stringify(q.alternativas), q.gabarito, q.comentario].map(sqlString).join(', ')});`);
const CHUNK = 150;
const files = [];
for (let i = 0; i < rows.length; i += CHUNK) {
  const f = path.join(outDir, `questoes-${String(i / CHUNK).padStart(3, '0')}.sql`);
  fs.writeFileSync(f, `${(i === 0 ? header : []).concat(rows.slice(i, i + CHUNK)).join('\n')}\n`);
  files.push(f);
}
const byDisc = {};
for (const q of seen.values()) byDisc[q.disciplina] = (byDisc[q.disciplina] || 0) + 1;
console.log(Object.entries(byDisc).sort((a, b) => b[1] - a[1]).map(([d, n]) => `  ${n}  ${d}`).join('\n'));
console.log(`${total} lidas, ${dropped} descartadas (sem 5 alternativas/gabarito/comentário ou com dado pessoal), ${seen.size} únicas → ${files.length} arquivo(s) em ${outDir}`);

if (upload) {
  console.log('\n☁️  Enviando para o Cloudflare D1…');
  for (const f of files) execFileSync('npx', ['--yes', 'wrangler@4', 'd1', 'execute', 'todahora-fontes', '--remote', '--file', f, '--yes'], { stdio: 'inherit' });
}
