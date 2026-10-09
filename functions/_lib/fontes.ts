// Private study-material knowledge base (course PDFs, extracted by scripts/ingest-fontes.mjs into
// the D1 database bound as FONTES). The excerpts are looked up and injected here, on the server,
// into the request that goes to the AI: they never reach the browser, so the app has no way to
// read or download the material. Only the model's own wording comes back.

interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}

const MAX_EXCERPTS = 4;
const CANDIDATES = 40;
const MAX_EXCERPT_CHARS = 1000;
const STOPWORDS = new Set(('a o os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para ' +
  'com sem sob sobre entre e ou que se seu sua seus suas ao aos como mais menos muito ser sao foi sera ' +
  'direito lei leis art artigo artigos questao questoes tema assunto aula conceito conceitos geral nocoes').split(' '));

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const termsOf = (text: string) => [...new Set(normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))].slice(0, 8);
const quoted = (terms: string[]) => terms.map((t) => `"${t}"*`);

// Course PDFs mix explanation with exam questions (each about something else), title pages and
// badly scanned tables. Those pulled the model off topic or named the course, so they are skipped.
const BANCAS = /\((?:[^)]*\b)?(CESPE|CEBRASPE|FGV|FCC|VUNESP|IDECAN|IBFC|IESES|AOCP|QUADRIX|IADES|CONSULPLAN|FUNDATEC|FEPESE|INSTITUTO|BANCA)\b/i;
const isUnusable = (text: string) =>
  (text.match(/(^|\n|\s)[a-eA-E]\)\s/g) || []).length >= 3
  || /\bgabarito\b|\bcoment[aá]rios?\s*:|\bjulgue(-os)?\b|\bassinale\b|\(\s*(certo|errado)\s*\)|lista de quest/i.test(text)
  || BANCAS.test(text)
  || /estrat[eé]gia|gran cursos|\bautor(es)?\s*:|\bíndice\b|\bsum[aá]rio\b|apresenta[cç][aã]o da aula/i.test(text);

// How much an excerpt is really about the topic: every word must occur, ideally several times and
// close together (the words of "segurança da informação" within a few words, in any order).
const relevance = (text: string, topic: string[]) => {
  const n = normalize(text);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  const counts = topic.map((t) => words.filter((w) => w.startsWith(t)).length);
  if (counts.some((c) => c === 0)) return 0;
  const min = Math.min(...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  if (min < 2 && total < (topic.length > 1 ? 4 : 3)) return 0;
  let together = 0;
  if (topic.length > 1) {
    const span = topic.length === 2 ? 5 : 8;
    for (let i = 0; i < words.length; i++) {
      const win = words.slice(i, i + span);
      if (topic.every((t) => win.some((w) => w.startsWith(t)))) { together += 1; i += span - 1; }
    }
    if (together === 0) return 0;
  }
  const plain = text.split(/\s+/).filter((w) => /^[A-Za-zÀ-ú]{3,}$/.test(w));
  const capitalised = plain.filter((w) => /^[A-ZÀ-Ú]/.test(w)).length / Math.max(1, plain.length);
  if (capitalised > 0.4) return 0; // badly scanned text ("Empresa Publics Mlnsta Qyalquer")
  return (min * 2 + total + together * 4) / Math.sqrt(Math.max(text.length, 300) / 1000);
};

const search = async (db: D1Like, query: string) => {
  // Candidates from the full-text index (topic words close together, then anywhere), re-ranked by relevance.
  const specific = query.includes(':') ? query.split(':').slice(1).join(':') : query;
  const topic = termsOf(specific);
  if (topic.length === 0) return [];
  const all = termsOf(query);
  const attempts: string[] = [];
  if (topic.length >= 2) attempts.push(`NEAR(${quoted(topic).join(' ')}, 12)`);
  attempts.push(quoted(all).join(' AND '), quoted(topic).join(' AND '));
  for (const match of attempts) {
    const { results } = await db.prepare(
      'SELECT f.text AS text FROM fontes_fts JOIN fontes f ON f.id = fontes_fts.rowid WHERE fontes_fts MATCH ?1 ORDER BY bm25(fontes_fts) LIMIT ?2',
    ).bind(match, CANDIDATES).all<{ text: string }>();
    const ranked = results
      .filter((r) => !isUnusable(r.text))
      .map((r) => ({ text: r.text, score: relevance(r.text, topic) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_EXCERPTS);
    if (ranked.length) return ranked.map((r) => r.text.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS));
  }
  return [];
};

const instructions = (query: string, excerpts: string[]) => `MATERIAL DE APOIO INTERNO para o tema "${query}". Use apenas para conferir e embasar o conteúdo.
Regras obrigatórias:
- Tudo o que você produzir deve tratar exclusivamente do tema "${query}". Use somente as partes dos trechos abaixo que tratam desse tema; ignore o resto.
- Não copie frases deste material: escreva com as suas próprias palavras.
- Nunca mencione que existe este material. Não escreva "segundo as fontes", "segundo a fonte", "texto de apoio", "conforme o material", "segundo o autor", "autores citados", nem nomes de métodos ou regras numeradas do material (como "Regra 1"). Cada questão e explicação deve se sustentar sozinha.
- O texto legal e as fontes oficiais fornecidos no pedido prevalecem. Se este material divergir da lei vigente, siga a lei; se for útil ao aluno, diga apenas que "alguns materiais trazem entendimento desatualizado".

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
      if (excerpts.length) {
        // After the app's own instructions, right before the request, so the topic rules keep priority.
        const messages = [...body.messages];
        let at = messages.length - 1;
        while (at > 0 && messages[at]?.role !== 'user') at -= 1;
        messages.splice(Math.max(0, at), 0, { role: 'system', content: instructions(query, excerpts) });
        body.messages = messages;
      }
      console.info(`[fontes] ${excerpts.length} trecho(s) para "${query.slice(0, 60)}"`);
    } catch (error) {
      console.warn('[fontes] busca falhou', error);
    }
  }
  return new Request(request, { body: JSON.stringify(body) });
};
