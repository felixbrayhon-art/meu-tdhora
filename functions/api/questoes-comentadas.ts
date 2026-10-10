// Real commented questions (table `questoes_comentadas` in the FONTES D1 database, loaded by
// scripts/ingest-questoes-comentadas.mjs). Nothing is generated: statement, five options, key and the professor's
// comment come exactly from the source, so no AI call is needed.
//
// POST { topic: "Direito Administrativo: Atos administrativos", count: 5 } → { questions: QuizQuestion[] }
interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}
interface Context { request: Request; env: Record<string, unknown> & { FONTES?: D1Like } }
interface Row { id: number; fonte: string | null; assunto: string | null; enunciado: string; alternativas: string; gabarito: string; comentario: string }

const MAX_QUESTIONS = 10;
const STOPWORDS = new Set(('a o os as um uma de do da dos das em no na nos nas por pelo pela para com sem sobre e ou que se ao aos ' +
  'como mais direito lei questao questoes tema assunto conceito conceitos geral nocoes').split(' '));
const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const termsOf = (text: string) => [...new Set(normalize(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t)))].slice(0, 6);

// Plural and singular forms of a term, without accents (the index removes them): atos/ato, proposições/proposição, legais/legal.
const variantsOf = (t: string) => {
  const forms = new Set([t, t.endsWith('s') ? t.slice(0, -1) : `${t}s`]);
  if (t.endsWith('oes')) forms.add(`${t.slice(0, -3)}ao`);
  if (t.endsWith('ao')) forms.add(`${t.slice(0, -2)}oes`);
  if (t.endsWith('ais')) forms.add(`${t.slice(0, -3)}al`);
  if (t.endsWith('al')) forms.add(`${t.slice(0, -2)}ais`);
  return [...forms];
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const onRequestPost = async (context: Context) => {
  const db = context.env.FONTES;
  if (!db) return json(503, { error: 'Banco de questões indisponível.' });
  let body: any;
  try { body = await context.request.clone().json(); } catch { return json(400, { error: 'Pedido inválido.' }); }
  const topic = typeof body?.topic === 'string' ? body.topic.slice(0, 200) : '';
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Number(body?.count) || 5));
  if (!topic) return json(400, { error: 'Informe o tema.' });

  // Terms must appear as whole words in the statement or the subject (not in the professor's comment, where any word
  // shows up in passing), allowing a plural: "excel" must not match "excelência", nor "advérbios" a question on concordância.
  // With "Matéria: assunto" only the assunto counts; falling back to the matéria alone would return unrelated questions.
  const specific = topic.includes(':') ? topic.split(':').slice(1).join(':') : topic;
  const terms = termsOf(specific);
  try {
    if (terms.length > 0) {
      const match = `{assunto materia enunciado} : (${terms.map((t) => `(${variantsOf(t).map((v) => `"${v}"`).join(' OR ')})`).join(' AND ')})`;
      const { results } = await db.prepare(
        'SELECT q.id, q.fonte, q.assunto, q.enunciado, q.alternativas, q.gabarito, q.comentario FROM questoes_comentadas_fts JOIN questoes_comentadas q ON q.id = questoes_comentadas_fts.rowid ' +
        'WHERE questoes_comentadas_fts MATCH ?1 ORDER BY bm25(questoes_comentadas_fts, 6.0, 2.0, 4.0, 0.0) LIMIT ?2',
      ).bind(match, count * 6).all<Row>();
      if (results.length) {
        const questions = results.map((row) => ({ row, r: Math.random() })).sort((a, b) => a.r - b.r).slice(0, count).flatMap(({ row }) => {
          const alt = JSON.parse(row.alternativas) as Record<string, string>;
          const options = ['A', 'B', 'C', 'D', 'E'].map((l) => alt[l]);
          const correctAnswer = ['A', 'B', 'C', 'D', 'E'].indexOf(row.gabarito);
          if (options.some((o) => !o) || correctAnswer < 0) return [];
          // The comment names options by letter ("a) Errada"), so the option order must stay as in the source.
          return [{ id: `qc-${row.id}`, question: row.enunciado, options, correctAnswer, explanation: row.comentario, topic: row.assunto ?? row.fonte ?? undefined, fromBank: true }];
        });
        return json(200, { questions });
      }
    }
  } catch (error) {
    console.warn('[questoes-comentadas] busca falhou', error);
  }
  return json(200, { questions: [] });
};
