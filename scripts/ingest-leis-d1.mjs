#!/usr/bin/env node
// Gera SQL para levar o texto das leis federais à base de fontes da IA (Cloudflare D1 `todahora-fontes`, tabela `fontes`).
//
//   node scripts/ingest-leis-d1.mjs --dist ~/fontes-todahora/leis-dist --start-id <maior id atual + 1> --out lote.sql [--max-chunks 15000]
//   node scripts/ingest-leis-d1.mjs --commit lote.sql.ids           (marca o lote como enviado, depois de importar com sucesso)
//
// O que entra: as leis do Vade Mecum revisadas à mão (public/vademecum/*.json) e as normas do catálogo com texto COMPILADO (alterações já
// aplicadas). Normas só com o texto original da publicação ficam de fora: a IA não deve citar como vigente um texto que pode ter mudado.
// O limite gratuito do D1 é ~100 mil linhas gravadas por dia (cada trecho grava 2), por isso o envio é em lotes: ordem de prioridade
// (as revisadas à mão, depois as de mais artigos) e o estado fica em ~/fontes-todahora/leis-d1-estado.json.
//
// Nome do documento: "Legislação Federal · Lei Federal - <título> (lei)". O filtro de consenso (consenso.ts) agrupa por quem vem antes
// de " - ": todas as leis viram UM voto independente ("Lei Federal"), à parte das aulas e dos resumos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const home = os.homedir();
const STATE = path.join(home, 'fontes-todahora', 'leis-d1-estado.json');
const readState = () => (fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { enviadas: [] });

if (flag('--commit')) {
  const ids = JSON.parse(fs.readFileSync(flag('--commit'), 'utf8'));
  const st = readState();
  st.enviadas = [...new Set([...st.enviadas, ...ids])];
  fs.writeFileSync(STATE, JSON.stringify(st));
  console.log(`marcadas ${ids.length} normas; total enviado: ${st.enviadas.length}`);
  process.exit(0);
}

const dist = flag('--dist') ?? path.join(home, 'fontes-todahora', 'leis-dist');
const startId = Number(flag('--start-id'));
const out = flag('--out');
const maxChunks = Number(flag('--max-chunks') ?? 15000);
if (!startId || !out) { console.error('uso: --dist <leis-dist> --start-id <n> --out <arquivo.sql> [--max-chunks 15000]'); process.exit(1); }

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;
const milhar = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dataBr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);
const LIMITE = 960; // o servidor corta cada trecho em 1000 caracteres (MAX_EXCERPT_CHARS)

// Pedaços de no máximo LIMITE caracteres, cortando em espaço; artigos curtos e vizinhos são juntados.
const chunkLei = (titulo, articles) => {
  const chunks = [];
  const cab = `[${titulo}] `;
  let atual = '';
  const fecha = () => { if (atual.trim()) chunks.push(cab + atual.trim()); atual = ''; };
  for (const a of articles) {
    const ctx = [a.capitulo, a.secao].filter(Boolean).join(' · ');
    let texto = (ctx && !atual ? `(${ctx}) ` : '') + a.texto;
    while (texto.length > LIMITE - cab.length) {
      const room = LIMITE - cab.length;
      let corte = texto.lastIndexOf(' ', room);
      if (corte < room * 0.5) corte = room;
      fecha();
      atual = texto.slice(0, corte);
      fecha();
      texto = texto.slice(corte).trim();
    }
    if ((atual + ' ' + texto).length > LIMITE - cab.length) fecha();
    atual = atual ? `${atual} ${texto}` : texto;
  }
  fecha();
  return chunks;
};

// 1) leis revisadas à mão
const types = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'types.ts'), 'utf8');
const curadas = [...types.matchAll(/\{ id: '([^']+)', name: '([^']+)', shortName: '([^']+)' \}/g)].map((m) => ({ id: m[1], nome: m[2] }));
const fila = [];
for (const c of curadas) {
  const f = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'vademecum', `${c.id}.json`);
  if (fs.existsSync(f)) fila.push({ key: `curada:${c.id}`, titulo: c.nome, load: () => JSON.parse(fs.readFileSync(f, 'utf8')) });
}
// 2) catálogo: só compiladas, as de mais artigos primeiro
const indice = JSON.parse(fs.readFileSync(path.join(dist, 'indice.json'), 'utf8'));
const blocoCache = new Map();
const bloco = (b) => { if (!blocoCache.has(b)) blocoCache.set(b, JSON.parse(fs.readFileSync(path.join(dist, 'blocos', `${b}.json`), 'utf8'))); return blocoCache.get(b); };
indice.filter((l) => l.versao === 'compilada').sort((a, b) => b.artigos - a.artigos || a.id.localeCompare(b.id)).forEach((l) => {
  const titulo = `${l.tipo} nº ${milhar(l.numero)}${l.data ? ` de ${dataBr(l.data)}` : ''}`;
  fila.push({ key: `cat:${l.id}`, titulo, load: () => bloco(l.bloco)[l.id] });
});

const enviadas = new Set(readState().enviadas);
const linhas = [];
const feitas = [];
let id = startId, total = 0;
for (const lei of fila) {
  if (enviadas.has(lei.key)) continue;
  const chunks = chunkLei(lei.titulo, lei.load());
  if (total > 0 && total + chunks.length > maxChunks) break;
  const doc = `Legislação Federal · Lei Federal - ${lei.titulo} (lei)`;
  for (const text of chunks) linhas.push(`INSERT INTO fontes (id, doc, subject, page, text) VALUES (${id++}, ${sqlString(doc)}, 'Legislação', NULL, ${sqlString(text)});`);
  total += chunks.length;
  feitas.push(lei.key);
}
if (!feitas.length) { console.log('nada novo para enviar'); process.exit(0); }
linhas.push(`INSERT INTO fontes_fts(rowid, text, subject, doc) SELECT id, text, subject, doc FROM fontes WHERE id >= ${startId};`);
fs.writeFileSync(out, linhas.join('\n') + '\n');
fs.writeFileSync(`${out}.ids`, JSON.stringify(feitas));
console.log(JSON.stringify({ normas: feitas.length, trechos: total, ids: `${startId}..${id - 1}`, restantes: fila.filter((l) => !enviadas.has(l.key) && !feitas.includes(l.key)).length, MB: +(fs.statSync(out).size / 1048576).toFixed(1) }));
