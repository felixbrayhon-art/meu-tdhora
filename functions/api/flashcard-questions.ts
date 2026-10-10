// Questions built from FC Concursos flashcards (table `flashcards` in the FONTES D1 database, loaded by
// scripts/ingest-flashcards.mjs). The card already holds the question and the commented right answer, so the AI
// only writes the four wrong options and why each one is wrong. The call goes through the same /api/ai gateway
// handler, so sign-in, guest limits and provider keys work exactly as for every other AI request.
//
// POST { topic: "Direito Administrativo: Organização administrativa", count: 5 } → { questions: QuizQuestion[] }
import { handleAIRequest } from '../../api/ai';
import { runNodeHandler } from '../_lib/nodeAdapter';

interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}
type Context = Parameters<typeof runNodeHandler>[1] & { env: Record<string, unknown> & { FONTES?: D1Like } };

interface Card { fc: string; materia: string | null; assunto: string | null; pergunta: string; resposta: string; comentario: string | null }

const MAX_QUESTIONS = 10;
const STOPWORDS = new Set(('a o os as um uma de do da dos das em no na nos nas por pelo pela para com sem sobre e ou que se ao aos ' +
  'como mais direito lei questao questoes tema assunto conceito conceitos geral nocoes').split(' '));
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const termsOf = (text: string) => [...new Set(normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))].slice(0, 6);

// The topic after "Matéria:" says what to study; the matéria alone is the fallback ("Direito Administrativo").
const findCards = async (db: D1Like, topic: string, count: number): Promise<Card[]> => {
  const specific = topic.includes(':') ? topic.split(':').slice(1).join(':') : topic;
  const attempts = [termsOf(specific), termsOf(topic)].filter((t) => t.length > 0);
  for (const terms of attempts) {
    const { results } = await db.prepare(
      // assunto and pergunta weigh most: a card that only mentions the words in passing ranks last.
      'SELECT f.fc, f.materia, f.assunto, f.pergunta, f.resposta, f.comentario FROM flashcards_fts JOIN flashcards f ON f.id = flashcards_fts.rowid ' +
      'WHERE flashcards_fts MATCH ?1 ORDER BY bm25(flashcards_fts, 6.0, 2.0, 4.0, 1.0) LIMIT ?2',
    ).bind(terms.map((t) => `"${t}"*`).join(' AND '), count * 6).all<Card>();
    if (results.length) {
      // Vary the set between requests, from the best-matching cards.
      return results.map((card) => ({ card, r: Math.random() })).sort((a, b) => a.r - b.r).slice(0, count).map((x) => x.card);
    }
  }
  return [];
};

// The first paragraph of the answer is the short answer; the bullets after it are the explanation.
// A yes/no question keeps the statement without the leading "Sim."/"Não.".
const correctOption = (resposta: string) => {
  let first = resposta.split(/\n\s*\n|\n\s*•/)[0].replace(/\s+/g, ' ').trim();
  first = first.replace(/^(sim|não)[,.:;]\s*/i, '');
  first = first.charAt(0).toUpperCase() + first.slice(1);
  if (first.length > 420) first = `${first.slice(0, 420).replace(/[^.]*$/, '').trim() || first.slice(0, 420)}`;
  return first;
};

const PROMPT = `Você é examinador de concursos (IDECAN, CEBRASPE, FGV). Cada item abaixo já tem a pergunta, a alternativa CORRETA e a explicação.
Para cada item, escreva QUATRO alternativas ERRADAS para a mesma pergunta:
- mesmo tamanho, estilo e tom da correta, plausíveis para quem estudou pouco;
- cada uma deve ser FALSA segundo a explicação do item (troque o conceito, inverta a regra, confunda institutos parecidos, generalize ou restrinja indevidamente);
- nunca "todas as anteriores", "nenhuma das anteriores", nem alternativas que digam o mesmo que a correta com outras palavras.
Para cada errada, escreva também uma frase curta dizendo por que está errada, com base na explicação.
Reescreva também a alternativa CORRETA em "correta_curta": o mesmo conteúdo, sem acrescentar, tirar ou mudar nenhuma regra, em uma frase de 80 a 200 caracteres.
As cinco alternativas (correta_curta e as quatro erradas) devem ter tamanho parecido, para que o tamanho não denuncie a resposta.
Responda só JSON: {"itens":[{"id":"<id do item>","correta_curta":"...","erradas":["...","...","...","..."],"por_que":["...","...","...","..."]}]}`;

const MODELS: Array<['groq' | 'openrouter', string]> = [
  ['groq', 'openai/gpt-oss-120b'],
  ['groq', 'openai/gpt-oss-20b'],
  ['openrouter', 'nvidia/nemotron-3-super-120b-a12b:free'],
  ['openrouter', 'qwen/qwen3.8-27b:free'],
  ['openrouter', 'google/gemma-4-31b-it:free'],
];

const askAI = async (context: Context, original: Request, content: string) => {
  let lastError = 'nenhum provedor respondeu';
  for (const [provider, model] of MODELS) {
    const url = new URL(original.url);
    url.pathname = '/api/ai';
    url.search = `?provider=${provider}`;
    const headers = new Headers(original.headers);
    headers.set('content-type', 'application/json');
    const request = new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, temperature: 0.6, max_completion_tokens: 6000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: PROMPT }, { role: 'user', content }] }),
    });
    const response = await runNodeHandler(handleAIRequest, { ...context, request });
    // Sign-in and origin problems are the same for every provider; quota or model errors try the next one.
    if (response.status === 401 || response.status === 403) return { error: response.status };
    if (!response.ok) { lastError = `${provider} HTTP ${response.status}`; continue; }
    try {
      const data = await response.json() as any;
      const text = String(data?.choices?.[0]?.message?.content ?? '').replace(/^```(?:json)?|```$/g, '').trim();
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      if (Array.isArray(parsed?.itens)) return { itens: parsed.itens as Array<{ id: string; correta_curta?: string; erradas: string[]; por_que: string[] }> };
      lastError = `${model}: JSON sem itens`;
    } catch (error) {
      lastError = `${model}: resposta ilegível`;
    }
  }
  return { error: 502, message: lastError };
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const onRequestPost = async (context: Context) => {
  const db = context.env.FONTES;
  if (!db) return json(503, { error: 'Banco de flashcards indisponível.' });
  let body: any;
  try { body = await context.request.clone().json(); } catch { return json(400, { error: 'Pedido inválido.' }); }
  const topic = typeof body?.topic === 'string' ? body.topic.slice(0, 200) : '';
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Number(body?.count) || 5));
  if (!topic) return json(400, { error: 'Informe o tema.' });

  let cards: Card[];
  try { cards = await findCards(db, topic, count); } catch (error) {
    console.warn('[flashcards] busca falhou', error);
    return json(200, { questions: [] });
  }
  if (cards.length === 0) return json(200, { questions: [] });

  const items = cards.map((c) => ({ id: c.fc, pergunta: c.pergunta, correta: correctOption(c.resposta), explicacao: `${c.resposta}${c.comentario ? `\n${c.comentario}` : ''}` }));
  const result = await askAI(context, context.request, items.map((i) => `ITEM id=${i.id}\nPERGUNTA: ${i.pergunta}\nCORRETA: ${i.correta}\nEXPLICAÇÃO: ${i.explicacao}`).join('\n\n---\n\n'));
  if ('error' in result && result.error) {
    return json(result.error === 502 ? 502 : Number(result.error), { error: result.error === 502 ? 'A IA não respondeu agora. Tente de novo em instantes.' : 'Não foi possível usar a IA agora.', detail: (result as any).message });
  }

  const byId = new Map((result.itens ?? []).map((i) => [String(i.id), i]));
  const questions = items.flatMap((item, index) => {
    const ai = byId.get(item.id);
    const wrong = (ai?.erradas ?? []).map((w) => String(w).trim()).filter((w) => w && normalize(w) !== normalize(item.correta) && normalize(w) !== normalize(String(ai?.correta_curta ?? ''))).slice(0, 4);
    if (wrong.length < 4) return [];
    const why = ai?.por_que ?? [];
    // The card's own answer is often much longer than the wrong options and gives the key away: use the AI's short
    // restatement when it exists and is not itself much longer than them. The explanation keeps the full answer.
    const short = String(ai?.correta_curta ?? '').trim();
    const longestWrong = Math.max(...wrong.map((w) => w.length));
    const correct = short.length >= 20 && short.length <= Math.max(220, longestWrong * 1.3) ? short : item.correta;
    const options = [{ text: correct, ok: true }, ...wrong.map((text) => ({ text, ok: false }))]
      .map((o) => ({ o, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.o);
    const card = cards[index];
    // The app may shuffle the options again: the explanation names options by their content, never by letter.
    const explanation = [
      card.resposta.trim(),
      card.comentario ? card.comentario.trim() : '',
      'Por que as outras alternativas estão erradas:',
      ...wrong.map((w, i) => `• "${w.length > 140 ? `${w.slice(0, 137)}…` : w}" — ${String(why[i] ?? 'contraria a regra acima.').trim()}`),
    ].filter(Boolean).join('\n\n');
    return [{
      id: `fc-${card.fc}`,
      question: card.pergunta,
      options: options.map((o) => o.text),
      correctAnswer: options.findIndex((o) => o.ok),
      explanation,
      topic: card.assunto ?? undefined,
      fromFlashcard: true,
    }];
  });
  console.info(`[flashcards] ${questions.length}/${cards.length} questão(ões) para "${topic.slice(0, 60)}"`);
  return json(200, { questions });
};
