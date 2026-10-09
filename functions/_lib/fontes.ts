// Private study-material knowledge base (course PDFs, extracted by scripts/ingest-fontes.mjs into
// the D1 database bound as FONTES). The excerpts are looked up and injected here, on the server,
// into the request that goes to the AI: they never reach the browser, so the app has no way to
// read or download the material. Only the model's own wording comes back.

interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}

const MAX_EXCERPTS = 5;
const MAX_EXCERPT_CHARS = 1000;
const STOPWORDS = new Set(('a o os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para ' +
  'com sem sob sobre entre e ou que se seu sua seus suas ao aos como mais menos muito ser sao foi sera ' +
  'direito lei leis art artigo artigos questao questoes tema assunto aula conceito conceitos geral nocoes').split(' '));

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const termsOf = (text: string) => [...new Set(normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))].slice(0, 8);
const ftsQuery = (terms: string[], op: 'AND') => terms.map((t) => `"${t}"*`).join(` ${op} `);

const search = async (db: D1Like, query: string) => {
  // Every term must match: first with the subject ("Matéria: tema"), then the topic alone. Matching any
  // single word pulled unrelated excerpts (e.g. "qualificado" for furto qualificado), so there is no OR.
  const specific = query.includes(':') ? query.split(':').slice(1).join(':') : query;
  const attempts: [string[], 'AND'][] = [[termsOf(query), 'AND'], [termsOf(specific), 'AND']];
  for (const [terms, op] of attempts) {
    if (terms.length === 0) continue;
    const { results } = await db.prepare(
      'SELECT f.text AS text FROM fontes_fts JOIN fontes f ON f.id = fontes_fts.rowid WHERE fontes_fts MATCH ?1 ORDER BY bm25(fontes_fts) LIMIT ?2',
    ).bind(ftsQuery(terms, op), MAX_EXCERPTS).all<{ text: string }>();
    if (results.length) return results.map((r) => r.text.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS));
  }
  return [];
};

const instructions = (excerpts: string[]) => `MATERIAL DE APOIO INTERNO (aulas preparatórias para concursos). Use apenas para conferir e embasar o conteúdo.
Regras obrigatórias:
- Não copie frases deste material: escreva tudo com as suas próprias palavras.
- Nunca mencione que existe este material, nem curso, autor, professor, arquivo, página ou site.
- O texto legal e as fontes oficiais fornecidos no pedido prevalecem. Se este material divergir da lei vigente, siga a lei; se for útil ao aluno, diga apenas que "alguns materiais trazem entendimento desatualizado".
- Ignore os trechos que não tiverem relação direta com o tema pedido.
- Questões de prova que aparecem aqui servem só para entender o estilo de cobrança: não as reproduza.

${excerpts.map((e, i) => `[${i + 1}] ${e}`).join('\n\n')}`;

/**
 * If the JSON body carries `fontes: { query }`, returns a copy of the request whose messages start
 * with the matching excerpts as a system message. The `fontes` field is always removed.
 */
export const withFontes = async (request: Request, db: D1Like | undefined): Promise<Request> => {
  if (request.method !== 'POST' || !(request.headers.get('content-type') || '').includes('json')) return request;
  const raw = await request.clone().text();
  let body: any;
  try { body = JSON.parse(raw); } catch { return request; }
  if (!body || typeof body !== 'object' || !('fontes' in body)) return request;
  const query = typeof body.fontes?.query === 'string' ? body.fontes.query.slice(0, 200) : '';
  delete body.fontes;
  if (db && query && Array.isArray(body.messages)) {
    try {
      const excerpts = await search(db, query);
      if (excerpts.length) body.messages = [{ role: 'system', content: instructions(excerpts) }, ...body.messages];
      console.info(`[fontes] ${excerpts.length} trecho(s) para "${query.slice(0, 60)}"`);
    } catch (error) {
      console.warn('[fontes] busca falhou', error);
    }
  }
  return new Request(request, { body: JSON.stringify(body) });
};
