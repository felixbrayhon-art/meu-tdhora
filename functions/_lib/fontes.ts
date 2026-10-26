// Private study-material knowledge base (course PDFs, extracted by scripts/ingest-fontes.mjs into
// the D1 database bound as FONTES). The excerpts are looked up and injected here, on the server,
// into the request that goes to the AI: they never reach the browser, so the app has no way to
// read or download the material. Only the model's own wording comes back.

import { analyze, clusterOf, descrever, escolherTrechos, montarPool, type Analise, type Trecho } from './consenso';

interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}

const MAX_EXCERPTS = 4;
// Autores com poucos documentos ficam atrás de quem tem milhares de trechos na busca geral. Se um deles não apareceu,
// uma busca só nele (pelo nome no início do documento) tenta incluí-lo no consenso.
const AUTORES = ['Radegondes', 'Marcelomapas', 'Quebrando Questões', 'Concurseiro Fora da Caixa', 'Lei Federal'];
const BUSCA_POR_AUTOR = 15;
const WIDE = 200; // se os melhores trechos vêm de uma só fonte, procura mais fundo por uma segunda fonte independente
const POOL = 12; // trechos relevantes analisados para o consenso (a IA recebe só os MAX_EXCERPTS melhores)
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
// Commented questions from "lei em questões" books are stored already structured (article, point tested,
// right answer, explanation, no loose options), so they are usable even though they mention the exam.
const isCommentedQuestion = (text: string) => /^[^.]{3,80}, art\. \S+[^]{0,120}?Ponto cobrado em prova/.test(text);
// Trechos de lei (scripts/ingest-leis-d1.mjs) não passam pelo filtro de questões: alíneas "a) b) c)" e palavras como "julgue" ou "assinale"
// aparecem no texto legal e seriam confundidas com alternativas de prova.
const isLei = (doc: string) => doc.startsWith('Legislação Federal · ');
const isUnusable = (text: string) => !isCommentedQuestion(text) && (
  (text.match(/(^|\n|\s)[a-eA-E]\)\s/g) || []).length >= 3
  || /\bgabarito\b|\bcoment[aá]rios?\s*:|\bjulgue(-os)?\b|\bassinale\b|\(\s*(certo|errado)\s*\)|lista de quest/i.test(text)
  || BANCAS.test(text)
  || /estrat[eé]gia|gran cursos|\bautor(es)?\s*:|\bíndice\b|\bsum[aá]rio\b|apresenta[cç][aã]o da aula/i.test(text)
  || normalize(text).replace(/\s+/g, '').includes('concurseiroforadacaixa')); // título do autor sai espaçado no PDF ("C o n c u r s e i r o ...")

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

const search = async (db: D1Like, query: string): Promise<{ excerpts: string[]; analise: Analise } | null> => {
  // Candidates from the full-text index (topic words close together, then anywhere), re-ranked by relevance.
  const specific = query.includes(':') ? query.split(':').slice(1).join(':') : query;
  const topic = termsOf(specific);
  if (topic.length === 0) return null;
  const all = termsOf(query);
  const attempts: string[] = [];
  if (topic.length >= 2) attempts.push(`NEAR(${quoted(topic).join(' ')}, 12)`);
  attempts.push(quoted(all).join(' AND '), quoted(topic).join(' AND '));
  for (const match of attempts) {
    const run = async (limit: number): Promise<Trecho[]> => {
      const { results } = await db.prepare(
        'SELECT f.doc AS doc, f.text AS text FROM fontes_fts JOIN fontes f ON f.id = fontes_fts.rowid WHERE fontes_fts MATCH ?1 ORDER BY bm25(fontes_fts) LIMIT ?2',
      ).bind(match, limit).all<{ doc: string; text: string }>();
      return results
        .filter((r) => isLei(r.doc) || !isUnusable(r.text))
        .map((r) => ({ doc: r.doc, text: r.text, score: relevance(r.text, topic) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);
    };
    let usable = await run(CANDIDATES);
    // Consenso só faz sentido com fontes independentes: se só uma apareceu, busca mais fundo antes de desistir.
    if (usable.length && new Set(usable.map((r) => clusterOf(r.doc))).size < 2) usable = await run(WIDE);
    // Autores que não apareceram na busca geral: busca direcionada só neles.
    const presentes = new Set(usable.map((r) => clusterOf(r.doc)));
    for (const autor of AUTORES) {
      if ([...presentes].some((c) => c.includes(normalize(autor).replace(/[^a-z0-9 ]/g, '').trim()))) continue;
      const { results } = await db.prepare(
        'SELECT f.doc AS doc, f.text AS text FROM fontes_fts JOIN fontes f ON f.id = fontes_fts.rowid WHERE fontes_fts MATCH ?1 AND f.doc LIKE ?2 ORDER BY bm25(fontes_fts) LIMIT ?3',
      ).bind(match, `% · ${autor} - %`, BUSCA_POR_AUTOR).all<{ doc: string; text: string }>();
      const extra = results.filter((r) => isLei(r.doc) || !isUnusable(r.text)).map((r) => ({ doc: r.doc, text: r.text, score: relevance(r.text, topic) })).filter((r) => r.score > 0);
      if (extra.length) usable = [...usable, ...extra].sort((a, b) => b.score - a.score);
    }
    const ranked: Trecho[] = montarPool(usable, POOL);
    if (ranked.length) {
      // Consenso: mede o quanto fontes INDEPENDENTES concordam; a IA recebe os melhores trechos, um por fonte independente primeiro.
      const analise = analyze(ranked);
      const excerpts = escolherTrechos(ranked, MAX_EXCERPTS).map((r) => r.text.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS));
      return { excerpts, analise };
    }
  }
  return null;
};

/** "ALTO;93;3;0" = nível; confiança em %; fontes independentes; divergências. */
const cabecalhoConsenso = (a: Analise) => `${a.nivel};${Math.round(a.confianca * 100)};${a.fontesIndependentes};${a.divergencias.length}`;

const instructions = (query: string, excerpts: string[], analise: Analise) => `MATERIAL DE APOIO INTERNO para o tema "${query}". Use apenas para conferir e embasar o conteúdo.
Regras obrigatórias:
- Tudo o que você produzir deve tratar exclusivamente do tema "${query}". Use somente as partes dos trechos abaixo que tratam desse tema; ignore o resto.
- Não copie frases deste material: escreva com as suas próprias palavras.
- Nunca mencione que existe este material. Não escreva "segundo as fontes", "segundo a fonte", "texto de apoio", "conforme o material", "segundo o autor", "autores citados", nem nomes de métodos ou regras numeradas do material (como "Regra 1"). Cada questão e explicação deve se sustentar sozinha.
- O texto legal e as fontes oficiais fornecidos no pedido prevalecem. Se este material divergir da lei vigente, siga a lei; se for útil ao aluno, diga apenas que "alguns materiais trazem entendimento desatualizado".

${excerpts.map((e, i) => `[${i + 1}] ${e}`).join('\n\n')}

${descrever(analise)}`;

/**
 * If the JSON body carries `fontes: { query }`, returns a copy of the request whose messages start
 * with the matching excerpts as a system message. The `fontes` field is always removed.
 */
export const withFontes = async (request: Request, db: D1Like | undefined): Promise<{ request: Request; consenso: string | null }> => {
  const untouched = { request, consenso: null };
  if (request.method !== 'POST' || !(request.headers.get('content-type') || '').includes('json')) return untouched;
  const raw = await request.clone().text();
  let body: any;
  try { body = JSON.parse(raw); } catch { return untouched; }
  if (!body || typeof body !== 'object' || !('fontes' in body)) return untouched;
  let consenso: string | null = null;
  const query = typeof body.fontes?.query === 'string' ? body.fontes.query.slice(0, 200) : '';
  delete body.fontes;
  if (db && query && Array.isArray(body.messages)) {
    try {
      const found = await search(db, query);
      if (found?.excerpts.length) {
        // After the app's own instructions, right before the request, so the topic rules keep priority.
        const messages = [...body.messages];
        let at = messages.length - 1;
        while (at > 0 && messages[at]?.role !== 'user') at -= 1;
        messages.splice(Math.max(0, at), 0, { role: 'system', content: instructions(query, found.excerpts, found.analise) });
        body.messages = messages;
      }
      const a = found?.analise;
      if (a && found?.excerpts.length) consenso = cabecalhoConsenso(a);
      console.info(`[fontes] ${found?.excerpts.length ?? 0} trecho(s) para "${query.slice(0, 60)}"` + (a ? ` | consenso ${a.nivel} ${Math.round(a.confianca * 100)}% | ${a.fontesIndependentes} fonte(s) independente(s) | confirmados ${a.confirmados.length}, unicos ${a.unicos.length}, divergencias ${a.divergencias.length}` : ''));
    } catch (error) {
      console.warn('[fontes] busca falhou', error);
    }
  }
  return { request: new Request(request, { body: JSON.stringify(body) }), consenso };
};

/** Copy of the response carrying the consensus summary for the app's badge. Only counts and a level: no source names or text. */
export const anexarConsenso = (response: Response, consenso: string | null): Response => {
  if (!consenso) return response;
  const headers = new Headers(response.headers);
  headers.set('x-consenso', consenso);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
