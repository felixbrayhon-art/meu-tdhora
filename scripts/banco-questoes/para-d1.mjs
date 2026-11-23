#!/usr/bin/env node
// Leva o banco de questões reais para o Cloudflare D1 (`todahora-questoes`, tabela `questoes`).
//
//   node scripts/banco-questoes/para-d1.mjs --json ~/fontes-todahora/banco-reais/d1/questoes-supabase.json --out /tmp/lote
//   for f in /tmp/lote-*.sql; do npx wrangler@4 d1 execute todahora-questoes --remote --file "$f" -y; done
//
// Dois limites do D1, os dois descobertos na carga de 2026-11-23:
//  - o arquivo inteiro: dividido por BYTES, não por quantidade de questões (de 250 em 250, um lote que
//    caísse num trecho de explicações compridas estourava e 2.500 questões ficaram de fora);
//  - cada COMANDO sozinho: um insert de ~53 KB volta SQLITE_TOOBIG ("statement too long"). Por isso a
//    questão de explicação longa entra com a explicação vazia e os pedaços dela vêm depois, em `update`
//    que vai somando (`explanation || '...'`). Funciona para qualquer tamanho de explicação.
//
// Por que existe: o banco morava no Supabase grátis, que PAUSA o projeto depois de 7 dias sem uso — e em
// 2026-11-23 o app ficou sem questão nenhuma por causa disso (o endereço parou de resolver em DNS). O D1 não
// pausa e já é usado pelas fontes da IA e pelas leis.
//
// O arquivo de entrada é o despejo cru da tabela do Supabase (`select=*`), então as colunas têm os mesmos
// nomes do Postgres. `alternatives` era jsonb e aqui vira TEXT com o mesmo JSON.
//
// A saída é dividida em vários .sql porque o `d1 execute --remote` não aceita um arquivo de 33 MB de uma vez.
import fs from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const entrada = flag('--json');
const saida = flag('--out');
const limiteBytes = Number(flag('--bytes') ?? 400_000);
if (!entrada || !saida) { console.error('uso: --json <despejo.json> --out <prefixo> [--bytes 400000]'); process.exit(1); }

const COLUNAS = ['id', 'source', 'external_id', 'import_subject', 'subject_raw', 'topic_raw', 'question_type',
  'statement', 'alternatives', 'correct_letter', 'explanation', 'content_hash', 'exam_board', 'organization',
  'position', 'area', 'exam_year', 'created_at'];

// O SQLite não tem tipo booleano nem jsonb: texto escapado por aspas dobradas, número cru, NULL sem aspas.
const valor = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  const texto = typeof v === 'object' ? JSON.stringify(v) : String(v);
  // \u0000 quebra o D1 e não existe em texto de questão; some em vez de derrubar o lote inteiro.
  return `'${texto.replace(/\u0000/g, '').replace(/'/g, "''")}'`;
};

const questoes = JSON.parse(fs.readFileSync(entrada, 'utf8'));
if (!Array.isArray(questoes) || !questoes.length) { console.error('o JSON não tem questão nenhuma'); process.exit(1); }

const faltando = COLUNAS.filter((c) => !(c in questoes[0]));
if (faltando.length) { console.error(`colunas que o despejo não tem: ${faltando.join(', ')}`); process.exit(1); }

const limiteComando = Number(flag('--bytes-comando') ?? 24_000);

// `or replace` para o script poder rodar de novo depois de um lote que falhou no meio.
const insert = (q) => `insert or replace into questoes (${COLUNAS.join(', ')}) values (${COLUNAS.map((c) => valor(q[c])).join(', ')});`;

/** Os comandos de uma questão: um só, ou o insert sem a explicação + os pedaços dela. */
const comandos = (q) => {
  const direto = insert(q);
  if (direto.length <= limiteComando) return [direto];
  const explicacao = String(q.explanation ?? '');
  const pedacos = [];
  for (let i = 0; i < explicacao.length; i += limiteComando / 2) pedacos.push(explicacao.slice(i, i + limiteComando / 2));
  return [insert({ ...q, explanation: '' }), ...pedacos.map((p) => `update questoes set explanation = explanation || ${valor(p)} where id = ${valor(q.id)};`)];
};

let arquivos = 0;
let escritas = 0;
let lote = [];
let bytes = 0;
const fechar = () => {
  if (!lote.length) return;
  fs.writeFileSync(`${saida}-${String(arquivos).padStart(3, '0')}.sql`, `${lote.join('\n')}\n`);
  arquivos += 1;
  lote = [];
  bytes = 0;
};
for (const q of questoes) {
  // Os pedaços de uma mesma questão não podem se separar em arquivos diferentes, nem trocar de ordem:
  // o primeiro é o insert e os outros somam a explicação nele.
  const sqls = comandos(q);
  const tamanho = sqls.reduce((n, s) => n + s.length + 1, 0);
  if (bytes && bytes + tamanho > limiteBytes) fechar();
  lote.push(...sqls);
  bytes += tamanho;
  escritas += 1;
  if (bytes >= limiteBytes) fechar();
}
fechar();
console.log(`${escritas} questões em ${arquivos} arquivos (até ${limiteBytes} bytes cada): ${saida}-000.sql …`);
