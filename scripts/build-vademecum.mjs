// Builds public/vademecum/<id>.json from the official compiled text on planalto.gov.br, in the same
// format as the existing files: [{ numero, titulo, capitulo, secao, subsecao, texto }].
// Legislation is not protected by copyright (Lei 9.610/98, art. 8º, IV).
//
//   node scripts/build-vademecum.mjs            (all laws below)
//   node scripts/build-vademecum.mjs lei-9784   (one law)
import fs from 'node:fs';
import path from 'node:path';

export const LEIS = [
  { id: 'lei-14133', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm', max: 194 },
  { id: 'lei-8112', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm' },
  { id: 'lei-9784', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm' },
  { id: 'lei-8429', url: 'https://www.planalto.gov.br/ccivil_03/leis/l8429.htm' },
  { id: 'lei-12527', url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm' },
  { id: 'lc-101', url: 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm' },
  { id: 'codigo-processo-penal', url: 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm' },
  { id: 'lei-11343', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm' },
  { id: 'codigo-tributario-nacional', url: 'https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm' },
  { id: 'lei-13869', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm' },
];

const OUT = path.resolve('public/vademecum');

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ordm: 'º', ordf: 'ª', sect: '§', deg: '°', ndash: '–', mdash: '—', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…' };
const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) ToDaHORA-vademecum' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4000));
  const charset = /charset=["']?utf-?8/i.test(head) ? 'utf-8' : 'windows-1252';
  return new TextDecoder(charset).decode(bytes);
};

// Planalto keeps revoked wording struck through next to the current one; only the current text is kept.
const htmlToLines = (html) => {
  const body = html
    .replace(/\r?\n/g, ' ') // source line breaks fall mid-sentence; paragraphs come from the tags below
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(strike|s|del)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<sup>\s*(?:<u>)?\s*([oa])\s*(?:<\/u>)?\s*<\/sup>/gi, (_, c) => (c.toLowerCase() === 'o' ? 'º' : 'ª'))
    .replace(/<\/(p|div|h\d|tr|li|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const lines = decodeEntities(body)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // Some pages (e.g. Lei 14.133) break "Art." and its number into separate paragraphs.
  const merged = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && /^Art\.?$/.test(prev)) merged[merged.length - 1] = `Art. ${line}`;
    else merged.push(line);
  }
  return merged;
};

const HEADING = /^(PARTE|LIVRO|T[IÍ]TULO|CAP[IÍ]TULO|SE[CÇ][AÃ]O|SUBSE[CÇ][AÃ]O)\b/i;
const ARTICLE = /^Art\.\s*(\d+)\s*(?:º|o|°|\.)?\s*(?:-\s*([A-Z])\b)?/;
const isAllCaps = (l) => l === l.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(l);

export const parseLaw = (lines) => {
  const articles = [];
  const ctx = { titulo: null, capitulo: null, secao: null, subsecao: null };
  let current = null;
  let rubrica = null;
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (/^Bras[ií]lia,\s/.test(line) && started) break; // signatures
    const art = line.match(ARTICLE);
    if (HEADING.test(line) && line.length < 160) {
      // "TÍTULO II" is usually followed by its name in caps on the next line.
      if (i + 1 < lines.length && isAllCaps(lines[i + 1]) && !HEADING.test(lines[i + 1]) && !ARTICLE.test(lines[i + 1])) line = `${line} ${lines[++i]}`;
      const kind = normalizeKind(line);
      if (kind === 'parte' || kind === 'livro' || kind === 'titulo') { ctx.titulo = line; ctx.capitulo = ctx.secao = ctx.subsecao = null; }
      else if (kind === 'capitulo') { ctx.capitulo = line; ctx.secao = ctx.subsecao = null; }
      else if (kind === 'secao') { ctx.secao = line; ctx.subsecao = null; }
      else ctx.subsecao = line;
      rubrica = null;
      continue;
    }
    if (art) {
      started = true;
      const numero = art[2] ? `${art[1]}-${art[2]}` : art[1];
      const prev = articles.findIndex((a) => a.numero === numero);
      current = { numero, ...ctx, texto: (rubrica ? `${rubrica}. ` : '') + line };
      // A repeated number is the newer wording printed after the old one: keep the latest.
      if (prev !== -1) articles.splice(prev, 1);
      articles.push(current);
      rubrica = null;
      continue;
    }
    if (!started) continue;
    // A short line without final punctuation right before an article is its rubrica ("Furto qualificado").
    const next = lines[i + 1] || '';
    if (line.length < 90 && !/[.;:,]$/.test(line) && !/^(§|Par[aá]grafo|[IVXLC]+\s*[-–]|[a-z]\))/.test(line) && ARTICLE.test(next)) {
      rubrica = line.replace(/\s*\((?:Inclu[ií]d|Reda[cç][aã]o|Vide|Vig[eê]ncia)[^)]*\)\s*/gi, '').trim() || null;
      continue;
    }
    if (current) current.texto += ` ${line}`;
  }
  return articles.map((a) => ({ ...a, texto: a.texto.replace(/\s+/g, ' ').trim() }));
};

const normalizeKind = (line) => {
  const n = line.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.startsWith('subsec')) return 'subsecao';
  if (n.startsWith('sec')) return 'secao';
  if (n.startsWith('cap')) return 'capitulo';
  if (n.startsWith('titulo')) return 'titulo';
  if (n.startsWith('livro')) return 'livro';
  return 'parte';
};

const build = async (lei) => {
  const html = await fetchText(lei.url);
  // Articles a law writes into other codes (Lei 14.133 adds arts. 337-E+ to the CP) are not its own.
  const articles = parseLaw(htmlToLines(html)).filter((a) => !lei.max || Number(a.numero.split('-')[0]) <= lei.max);
  if (articles.length < 10) throw new Error(`${lei.id}: só ${articles.length} artigos — formato inesperado`);
  fs.writeFileSync(path.join(OUT, `${lei.id}.json`), JSON.stringify(articles));
  const last = articles[articles.length - 1];
  console.log(`✓ ${lei.id}: ${articles.length} artigos (último: art. ${last.numero}), ${(JSON.stringify(articles).length / 1024).toFixed(0)} KB`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const wanted = process.argv.slice(2);
  for (const lei of LEIS.filter((l) => wanted.length === 0 || wanted.includes(l.id))) {
    try { await build(lei); } catch (error) { console.error(`✗ ${lei.id}: ${error.message}`); }
  }
}
