// Real commented questions. Primary source: table `questoes_comentadas` on Supabase (supabase/schema-comentadas.sql, searched by the
// `buscar_comentadas` function); the same table in the FONTES D1 database (scripts/ingest-questoes-comentadas.mjs) is only the
// fallback when Supabase does not answer. Nothing is generated: statement, five options, key and the professor's comment come
// exactly from the source, so no AI call is needed.
//
// POST { topic: "Direito Administrativo: Atos administrativos", count: 5 } → { questions: QuizQuestion[] }
interface D1Like {
  prepare: (sql: string) => { bind: (...values: unknown[]) => { all: <T>() => Promise<{ results: T[] }> } };
}
interface Context { request: Request; env: Record<string, unknown> & { FONTES?: D1Like } }
interface Row { id: number; disciplina?: string | null; fonte: string | null; assunto: string | null; enunciado: string; alternativas: string | Record<string, string>; gabarito: string; comentario: string }

// The publishable key is public by design: the table only has a SELECT policy.
const SUPABASE_URL = 'https://tslcjsvetgqgsgqpyruf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zEesejaS_9r3Ox7OJaaZ-Q_rgt9TWIz';
const SUPABASE_COLUMNS = 'id,fonte,assunto,enunciado,alternativas,gabarito,comentario';
const supabase = (path: string, init: RequestInit = {}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  signal: AbortSignal.timeout(8000),
});

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

// Discipline named by the matéria before the colon ("Direito Penal: legítima defesa"). Order matters: the more specific names first.
const DISCIPLINAS: Array<[RegExp, string]> = [
  [/processual penal/, 'Direito Processual Penal'], [/processual civil/, 'Direito Processual Civil'], [/administrativ/, 'Direito Administrativo'],
  [/constitucional/, 'Direito Constitucional'], [/penal/, 'Direito Penal'], [/portugu|redacao/, 'Língua Portuguesa'], [/raciocinio|logica|matematica/, 'Raciocínio Lógico'],
  [/informatica/, 'Informática'], [/direitos humanos/, 'Direitos Humanos'], [/legislacao|extravagante|especial/, 'Legislação Especial'],
  [/civil/, 'Direito Civil'], [/contabil|financ|orcamento/, 'Contabilidade e Finanças'], [/administracao/, 'Administração'],
];
const disciplinaOf = (matter: string) => DISCIPLINAS.find(([re]) => re.test(normalize(matter)))?.[1];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const toQuestions = (rows: Row[], count: number) => rows.map((row) => ({ row, r: Math.random() })).sort((a, b) => a.r - b.r).slice(0, count).flatMap(({ row }) => {
  const alt = (typeof row.alternativas === 'string' ? JSON.parse(row.alternativas) : row.alternativas) as Record<string, string>;
  const options = ['A', 'B', 'C', 'D', 'E'].map((l) => alt[l]);
  const correctAnswer = ['A', 'B', 'C', 'D', 'E'].indexOf(row.gabarito);
  if (options.some((o) => !o) || correctAnswer < 0) return [];
  // The comment names options by letter ("a) Errada"), so the option order must stay as in the source.
  return [{ id: `qc-${row.id}`, question: row.enunciado, options, correctAnswer, explanation: row.comentario, topic: row.assunto ?? row.fonte ?? undefined, fromBank: true }];
});

// The Portuguese stemmer of Postgres does not join "proposições" with "proposição" (nor "legais" with "legal"): send the singular.
const singular = (text: string) => text.replace(/\p{L}{4,}/gu, (w) => w.replace(/(õ|ã)es$/i, 'ão').replace(/ãos$/i, 'ão').replace(/ais$/i, 'al').replace(/éis$/i, 'el').replace(/óis$/i, 'ol'));

// Supabase: "Matéria: assunto" → the discipline plus the subject words (Postgres 'portuguese' search: stems and plurals); only the matéria → a random
// slice of that discipline. Throws when Supabase fails, so the caller can fall back to D1.
const viaSupabase = async (topic: string, disciplina: string | undefined, subject: string, count: number): Promise<Row[]> => {
  if (subject.trim()) {
    const response = await supabase('rpc/buscar_comentadas', { method: 'POST', body: JSON.stringify({ p_topic: singular(subject.slice(0, 160)), p_disciplina: disciplina ?? null, p_count: Math.min(50, count * 6) }) });
    if (!response.ok) throw new Error(`supabase ${response.status}`);
    return response.json();
  }
  if (disciplina) {
    const filter = `questoes_comentadas?select=${SUPABASE_COLUMNS}&disciplina=eq.${encodeURIComponent(disciplina)}`;
    const head = await supabase(filter, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    if (!head.ok) throw new Error(`supabase ${head.status}`);
    const total = Number((head.headers.get('content-range') ?? '').split('/')[1]) || 0;
    if (!total) return [];
    const from = Math.floor(Math.random() * Math.max(1, total - count * 6));
    const response = await supabase(filter, { headers: { Range: `${from}-${from + count * 6 - 1}` } });
    if (!response.ok) throw new Error(`supabase ${response.status}`);
    return response.json();
  }
  return [];
};

export const onRequestPost = async (context: Context) => {
  let body: any;
  try { body = await context.request.clone().json(); } catch { return json(400, { error: 'Pedido inválido.' }); }
  const topic = typeof body?.topic === 'string' ? body.topic.slice(0, 200) : '';
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Number(body?.count) || 5));
  if (!topic) return json(400, { error: 'Informe o tema.' });

  // "Matéria: assunto" filters by the discipline first (a question on the jury never answers "legítima defesa" in Direito Penal),
  // then the subject words must appear as whole words in the statement or subject, allowing a plural ("excel" must not match
  // "excelência"). The professor's comment is not searched: any word shows up there in passing. When nothing matches the subject
  // the answer is empty and the app completes with flashcards and AI, instead of returning unrelated questions.
  const colon = topic.indexOf(':');
  const disciplina = disciplinaOf(colon >= 0 ? topic.slice(0, colon) : topic);
  const terms = colon >= 0 ? termsOf(topic.slice(colon + 1)) : disciplina ? [] : termsOf(topic);
  const subject = colon >= 0 ? topic.slice(colon + 1) : disciplina ? '' : topic;
  try {
    return json(200, { questions: toQuestions(await viaSupabase(topic, disciplina, subject, count), count) });
  } catch (error) {
    console.warn('[questoes-comentadas] Supabase indisponível, usando o D1', error);
  }
  const db = context.env.FONTES;
  if (!db) return json(503, { error: 'Banco de questões indisponível.' });
  const pick = (rows: Row[]) => rows.map((row) => ({ row, r: Math.random() })).sort((a, b) => a.r - b.r).slice(0, count).flatMap(({ row }) => {
    const alt = (typeof row.alternativas === 'string' ? JSON.parse(row.alternativas) : row.alternativas) as Record<string, string>;
    const options = ['A', 'B', 'C', 'D', 'E'].map((l) => alt[l]);
    const correctAnswer = ['A', 'B', 'C', 'D', 'E'].indexOf(row.gabarito);
    if (options.some((o) => !o) || correctAnswer < 0) return [];
    // The comment names options by letter ("a) Errada"), so the option order must stay as in the source.
    return [{ id: `qc-${row.id}`, question: row.enunciado, options, correctAnswer, explanation: row.comentario, topic: row.assunto ?? row.fonte ?? undefined, fromBank: true }];
  });
  const COLUMNS = 'q.id, q.fonte, q.assunto, q.enunciado, q.alternativas, q.gabarito, q.comentario';
  try {
    if (terms.length > 0) {
      const match = `{assunto materia enunciado} : (${terms.map((t) => `(${variantsOf(t).map((v) => `"${v}"`).join(' OR ')})`).join(' AND ')})`;
      const { results } = await db.prepare(
        `SELECT ${COLUMNS} FROM questoes_comentadas_fts JOIN questoes_comentadas q ON q.id = questoes_comentadas_fts.rowid ` +
        `WHERE questoes_comentadas_fts MATCH ?1 ${disciplina ? 'AND q.disciplina = ?3 ' : ''}ORDER BY bm25(questoes_comentadas_fts, 6.0, 2.0, 4.0, 0.0) LIMIT ?2`,
      ).bind(...(disciplina ? [match, count * 6, disciplina] : [match, count * 6])).all<Row>();
      return json(200, { questions: pick(results) });
    }
    if (disciplina) {
      // Only the matéria was asked: any question of that discipline.
      const { results } = await db.prepare(`SELECT ${COLUMNS} FROM questoes_comentadas q WHERE q.disciplina = ?1 ORDER BY RANDOM() LIMIT ?2`).bind(disciplina, count).all<Row>();
      return json(200, { questions: pick(results) });
    }
  } catch (error) {
    console.warn('[questoes-comentadas] busca falhou', error);
  }
  return json(200, { questions: [] });
};
