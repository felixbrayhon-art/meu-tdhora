#!/usr/bin/env node
// Converte o acervo de leis federais do repositório ctresb/leis (Markdown com cabeçalho YAML) para o formato do Vade Mecum do app.
//
//   node scripts/build-vademecum-leis.mjs --src <clone do ctresb/leis> --out <pasta de saída> [--skip id1,id2]
//
// Como obter a fonte (o repositório inteiro tem 4 GB; só as leis federais precisam, ~0,7 GB):
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/ctresb/leis.git leis-src && cd leis-src
//   git sparse-checkout set --no-cone /federal/leis-ordinarias /federal/leis-complementares /federal/leis-delegadas /federal/decretos-lei /federal/emendas-constitucionais
// Leis que o app já tem revisadas à mão (public/vademecum/*.json) ficam de fora com --skip:
//   --skip lei-14133,lei-8112,lei-9784,lei-8429,lei-12527,lc-101,lei-11343,dl-2848,dl-3689,lei-5172,lei-13869
// Publicar: copie a saída para ~/fontes-todahora/leis-dist (o scripts/deploy.sh a inclui no site).
//
// Saída:
//   <out>/indice.json                 uma linha por norma (id, tipo, número, data, título, ementa, versão, bloco, nº de artigos)
//   <out>/blocos/<tipo>-<década>.json { "<id>": [ { numero, titulo, capitulo, secao, subsecao, texto }, ... ], ... }
//
// Só entram normas com `revogada: false`. `versao` diz se o texto é a versão compilada (com as alterações aplicadas) ou o texto original da
// publicação, que pode ter sido alterado depois: o app mostra esse aviso para o aluno.
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
if (!args.src || !args.out) { console.error('uso: --src <clone> --out <pasta> [--skip id1,id2]'); process.exit(1); }
const SKIP = new Set((args.skip ?? '').split(',').filter(Boolean));

const TIPOS = {
  'leis-ordinarias': { slug: 'lei', nome: 'Lei' },
  'leis-complementares': { slug: 'lc', nome: 'Lei Complementar' },
  'leis-delegadas': { slug: 'ld', nome: 'Lei Delegada' },
  'decretos-lei': { slug: 'dl', nome: 'Decreto-Lei' },
  'emendas-constitucionais': { slug: 'ec', nome: 'Emenda Constitucional' },
};

const unquote = (s) => s.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
const parseFront = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const fm = {};
  m[1].split('\n').forEach((line) => { const k = line.match(/^([a-z_]+):\s*(.*)$/); if (k) fm[k[1]] = unquote(k[2]); });
  return { fm, body: text.slice(m[0].length) };
};
const clean = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// "Art. 1º", "**Art.** 1º", "**Art**. 1º", "Artigo 1º", com ou sem negrito e com sufixos de emenda ("121-A").
const ART = /^Art(?:igo)?s?\.?\s*(\d[\d.]*)\s*(?:[ºo°])?(?:\s*[-–]\s*([A-Z]{1,3}(?:\s*[-–]\s*[A-Z]{1,3})*))?(?=[\s.,:;\-–—]|$)/i;
const numeroArtigo = (m) => m[1].replace(/\./g, '') + (m[2] ? '-' + m[2].replace(/\s*[-–]\s*/g, '-') : '');

const toArticles = (body) => {
  const articles = [];
  let titulo = null, capitulo = null, secao = null, subsecao = null;
  let cur = null, fechado = false;
  const push = () => { if (cur) { cur.texto = clean(cur.partes.join(' ')); delete cur.partes; articles.push(cur); cur = null; } };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{2,6}\s+(.*)$/);
    if (h) {
      const t = clean(h[1].replace(/\s*[—–]\s*/, ' '));
      if (/^(LIVRO|PARTE|T[ÍI]TULO)\b/i.test(t)) { push(); titulo = t; capitulo = secao = subsecao = null; }
      else if (/^CAP[ÍI]TULO\b/i.test(t)) { push(); capitulo = t; secao = subsecao = null; }
      else if (/^SUBSE[ÇC][ÃA]O\b/i.test(t)) { push(); subsecao = t; }
      else if (/^SE[ÇC][ÃA]O\b/i.test(t)) { push(); secao = t; subsecao = null; }
      fechado = false;
      continue;
    }
    const semNegrito = line.replace(/\*\*/g, '').trim();
    const a = semNegrito.match(ART);
    if (a) { push(); fechado = false; cur = { numero: numeroArtigo(a), titulo, capitulo, secao, subsecao, partes: [semNegrito] }; continue; }
    if (/^Bras[ií]lia,/i.test(line)) { fechado = true; continue; }
    if (cur && !fechado) cur.partes.push(line);
  }
  push();
  // Numeração repetida na mesma norma (anexos, regulamentos): a repetição vira "1 (2)", para as chaves da tela continuarem únicas.
  const vistos = new Map();
  articles.forEach((a) => { const k = (vistos.get(a.numero) ?? 0) + 1; vistos.set(a.numero, k); if (k > 1) a.numero = `${a.numero} (${k})`; });
  return articles;
};

const lerNormas = () => {
  const out = [];
  for (const [dir, tipo] of Object.entries(TIPOS)) {
    const base = path.join(args.src, 'federal', dir);
    if (!fs.existsSync(base)) continue;
    for (const ano of fs.readdirSync(base)) {
      const pAno = path.join(base, ano);
      if (!fs.statSync(pAno).isDirectory()) continue;
      for (const f of fs.readdirSync(pAno)) if (f.endsWith('.md')) out.push({ dir, tipo, file: path.join(pAno, f) });
    }
  }
  return out;
};

const normas = lerNormas();
fs.rmSync(args.out, { recursive: true, force: true });
fs.mkdirSync(path.join(args.out, 'blocos'), { recursive: true });

const usados = new Set();
const indice = [];
const blocos = new Map();
const stats = { lidas: normas.length, revogadas: 0, ignoradas: 0, semArtigos: 0, vigentes: 0 };

for (const n of normas) {
  const parsed = parseFront(fs.readFileSync(n.file, 'utf8'));
  if (!parsed) { stats.ignoradas++; continue; }
  const { fm, body } = parsed;
  if (fm.revogada !== 'false') { stats.revogadas++; continue; }
  const numero = (fm.numero ?? '').replace(/\D/g, '');
  const data = fm.data ?? '';
  if (!numero) { stats.ignoradas++; continue; }
  let id = `${n.tipo.slug}-${numero}`;
  if (SKIP.has(id)) { stats.ignoradas++; continue; }
  if (usados.has(id)) id = `${id}-${data.slice(0, 4)}`;
  if (usados.has(id)) { stats.ignoradas++; continue; }
  usados.add(id);

  let articles = toArticles(body);
  if (articles.length === 0) {
    const texto = clean(body.replace(/^# .*$/m, ''));
    if (!texto) { stats.ignoradas++; continue; }
    articles = [{ numero: '—', titulo: null, capitulo: null, secao: null, subsecao: null, texto }];
    stats.semArtigos++;
  }
  const ano = Number(data.slice(0, 4)) || 0;
  const porAno = n.tipo.slug === 'lei' || n.tipo.slug === 'dl';
  const bloco = `${n.tipo.slug}-${ano ? (porAno ? ano : Math.floor(ano / 10) * 10) : 'sd'}`;
  if (!blocos.has(bloco)) blocos.set(bloco, {});
  blocos.get(bloco)[id] = articles;
  indice.push({
    id, tipo: n.tipo.nome, numero, data, ementa: (fm.ementa ?? '').slice(0, 240),
    versao: /compilada/i.test(fm.versao_texto ?? '') ? 'compilada' : 'original', bloco, artigos: articles.length,
  });
  stats.vigentes++;
}

indice.sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(args.out, 'indice.json'), JSON.stringify(indice));
let totalBytes = 0, maior = 0;
for (const [nome, conteudo] of blocos) {
  const s = JSON.stringify(conteudo);
  fs.writeFileSync(path.join(args.out, 'blocos', `${nome}.json`), s);
  totalBytes += Buffer.byteLength(s); maior = Math.max(maior, Buffer.byteLength(s));
}
console.log(JSON.stringify({ ...stats, blocos: blocos.size, MBblocos: +(totalBytes / 1048576).toFixed(1), maiorBlocoMB: +(maior / 1048576).toFixed(1), MBindice: +(fs.statSync(path.join(args.out, 'indice.json')).size / 1048576).toFixed(2) }, null, 1));
