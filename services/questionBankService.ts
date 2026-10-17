import {
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, cleanData } from '../src/lib/firebase';
import { bankRpc, bankSelect, BankRow } from '../src/lib/supabaseBank';
import { PublishedQuestion, QuestionAlternative, QuestionDraft, QuestionImportBatch, QuestionType, QuizQuestion } from '../types';

export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
};

// Lets an admin fix a published question's explanation in place while
// answering it (QuizPlayer's "editar explicação" toggle) — same `questions`
// doc the student is already reading from `mapBankQuestion` below, so the
// fix is live for every future student immediately, not just a local draft.
export const updateQuestionExplanation = async (questionId: string, explanation: string): Promise<void> => {
  await updateDoc(doc(db, 'questions', questionId), { explanation });
};

export const listImports = async (): Promise<QuestionImportBatch[]> => {
  const snap = await getDocs(query(collection(db, 'imports'), orderBy('importedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<QuestionImportBatch, 'id'>) }));
};

export const listDraftsForImport = async (importId: string): Promise<QuestionDraft[]> => {
  const snap = await getDocs(query(collection(db, 'question_drafts'), where('importId', '==', importId)));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<QuestionDraft, 'id'>) }))
    .sort((a, b) => a.number - b.number);
};

export const updateDraft = async (draftId: string, patch: Partial<QuestionDraft>): Promise<void> => {
  const { id: _id, ...rest } = patch;
  await updateDoc(doc(db, 'question_drafts', draftId), cleanData(rest));
};

export const rejectDraft = async (draftId: string): Promise<void> => {
  await updateDoc(doc(db, 'question_drafts', draftId), { status: 'rejected' });
};

// A draft counts as a likely duplicate either by the strong per-source key
// (same origin question re-exported) or by normalized statement hash
// (the same question surfacing from a different source later on).
export const findPossibleDuplicates = async (draft: QuestionDraft): Promise<PublishedQuestion[]> => {
  const bySource = await getDocs(
    query(
      collection(db, 'questions'),
      where('source', '==', draft.source),
      where('externalId', '==', draft.externalId)
    )
  );
  const byHash = await getDocs(query(collection(db, 'questions'), where('contentHash', '==', draft.contentHash)));

  const seen = new Map<string, PublishedQuestion>();
  for (const d of [...bySource.docs, ...byHash.docs]) {
    seen.set(d.id, { id: d.id, ...(d.data() as Omit<PublishedQuestion, 'id'>) });
  }
  return [...seen.values()];
};

export const approveDraft = async (draft: QuestionDraft, approvedBy: string): Promise<void> => {
  const published: Omit<PublishedQuestion, 'id'> = {
    source: draft.source,
    externalId: draft.externalId,
    importSubject: draft.importSubject,
    importYear: draft.importYear,
    questionType: draft.questionType,
    subjectRaw: draft.subjectRaw,
    topicRaw: draft.topicRaw,
    statement: draft.statement,
    alternatives: draft.alternatives,
    correctLetter: draft.correctLetter,
    explanation: draft.explanation,
    contentHash: draft.contentHash,
    approvedAt: Date.now(),
    approvedBy,
    // Carried through from the draft for sources that set them (currently
    // only worker/exam_discovery — see PublishedQuestion's own comment).
    // Previously dropped here even though the type declared them, so an
    // approved exam-discovery question silently lost its banca/órgão/
    // cargo/ano the moment it left question_drafts.
    examBoard: draft.examBoard,
    organization: draft.organization,
    position: draft.position,
    examYear: draft.examYear,
  };
  await setDoc(doc(db, 'questions', draft.id), cleanData(published));
  await deleteDoc(doc(db, 'question_drafts', draft.id));
};

// --- Student-facing reads (TDH Questões "Concurso" tab) ---
// The published bank is small enough right now that listing every doc to
// derive subjects, and to sample a subject client-side, is simpler and
// cheaper than standing up composite indexes for random/faceted queries.
// Revisit (a dedicated subjects collection, server-side random sampling)
// once `questions` grows into the thousands.

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fromBankRow = (r: BankRow): PublishedQuestion => ({
  id: r.id,
  source: r.source,
  externalId: r.external_id,
  importSubject: r.import_subject,
  questionType: r.question_type as QuestionType,
  subjectRaw: r.subject_raw,
  topicRaw: r.topic_raw,
  statement: r.statement,
  alternatives: r.alternatives,
  correctLetter: r.correct_letter,
  explanation: r.explanation,
  contentHash: r.content_hash,
  approvedAt: 0,
  approvedBy: 'supabase',
  examBoard: r.exam_board,
  organization: r.organization,
  position: r.position,
  examYear: r.exam_year,
});

// The student-facing bank now lives on Supabase (functions in supabase-schema.sql). When it cannot answer, the old Firestore
// read below still runs, so a question published there earlier stays reachable.
const withBankFallback = async <T,>(viaSupabase: () => Promise<T>, viaFirestore: () => Promise<T>): Promise<T> => {
  try { return await viaSupabase(); } catch (error) {
    console.warn('[banco] Supabase indisponível, usando o Firestore:', error);
    return viaFirestore();
  }
};

const mapBankQuestion = (q: PublishedQuestion): QuizQuestion => {
  const sortedAlternatives = [...q.alternatives].sort((a, b) => a.position - b.position);
  const correctIndex = sortedAlternatives.findIndex(a => a.letter === q.correctLetter);
  // Prefer matéria/assunto (fc_concursos-style decks); a source like
  // exam_discovery never sets those, so fall back to the exam's own
  // banca/cargo/ano — always something more useful than the generic label.
  const subjectTopic = [q.subjectRaw, q.topicRaw].filter(Boolean).join(' · ');
  const examTopic = [q.examBoard, q.organization, q.position, q.examYear].filter(Boolean).join(' · ');
  const topic = subjectTopic || examTopic || 'Nosso Banco de Questões';
  return {
    id: `bank-${q.id}`,
    question: `<p>${escapeHtml(q.statement)}</p>`,
    options: sortedAlternatives.map(a => a.text),
    correctAnswer: Math.max(0, correctIndex),
    explanation: q.explanation,
    topic,
  };
};

// Value + how many published questions match it — shown to the student so
// they know upfront how many questions they can actually pull/save for
// that matéria/assunto, instead of finding out only after asking for more
// than exists.
export interface BankFacetOption {
  value: string;
  count: number;
  /** Texto mostrado no lugar de `value` (usado em "Todas as bancas"). */
  label?: string;
}

export interface BankTopicFacets {
  total: number;
  topics: BankFacetOption[];
}

// Level 1: the main discipline chosen at import time (importSubject) —
// "Direito Penal", "Direito Constitucional" etc.
// `area` filters the matérias to those that have questions in that área (supabase/areas-primeiro.sql); null = all.
export const listBankImportSubjects = (area: string | null = null): Promise<BankFacetOption[]> =>
  withBankFallback(() => bankRpc<BankFacetOption[]>('bank_subjects', { p_area: area }), listBankImportSubjectsFirestore);

// Every área of the bank with its question count (Jurídica, Policial, Tribunais, Fiscal, Administrativa, Concursos gerais…).
export const listBankAllAreas = (): Promise<BankFacetOption[]> =>
  bankRpc<BankFacetOption[]>('bank_all_areas').catch(() => []);
const listBankImportSubjectsFirestore = async (): Promise<BankFacetOption[]> => {
  const snap = await getDocs(collection(db, 'questions'));
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const subject = (d.data() as PublishedQuestion).importSubject;
    if (subject) counts.set(subject, (counts.get(subject) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};

const buildBankConstraints = (importSubject: string, topic: string | null, area: string | null) => {
  const constraints = [where('importSubject', '==', importSubject)];
  if (topic) constraints.push(where('subjectRaw', '==', topic));
  if (area) constraints.push(where('position', '==', area));
  return constraints;
};

const countByField = <K extends 'subjectRaw' | 'position'>(docs: { data: () => unknown }[], field: K): BankFacetOption[] => {
  const counts = new Map<string, number>();
  docs.forEach(d => {
    const value = (d.data() as PublishedQuestion)[field];
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};

// Level 2: FC Concursos' own (finer) classification within that discipline
// (subjectRaw) — only fetched once a level-1 matéria has been chosen.
// `total` is the count for "Todos os assuntos" (every question under this
// matéria/área, including any with no subjectRaw at all). Matéria is the
// only required filter anywhere in this file — área here is an OPTIONAL
// cross-filter: when set, assunto counts/options reflect just that área,
// but leaving it unset never blocks fetching by matéria+assunto alone.
export const listBankTopicsForSubject = (importSubject: string, area: string | null = null): Promise<BankTopicFacets> =>
  withBankFallback(
    async () => {
      const [topics, total] = await Promise.all([
        bankRpc<BankFacetOption[]>('bank_topics', { p_subject: importSubject, p_area: area }),
        bankRpc<number>('bank_count', { p_subject: importSubject, p_topic: null, p_area: area }),
      ]);
      return { total: Number(total), topics };
    },
    () => listBankTopicsForSubjectFirestore(importSubject, area),
  );
const listBankTopicsForSubjectFirestore = async (importSubject: string, area: string | null = null): Promise<BankTopicFacets> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, null, area)));
  return { total: snap.size, topics: countByField(snap.docs, 'subjectRaw') };
};

// "Área" is a coarse tag independent of subjectRaw/topicRaw (e.g. "Policial"
// — set by worker/scripts/import_batch.py imports whose source deck targets
// a specific career track), scoped within a matéria the same way assunto is.
// Only questions that actually carry a `position` show up here — imports
// that never set it (most of the bank, today) are simply absent from the
// list rather than showing as an empty-label facet. `topic` is likewise an
// OPTIONAL cross-filter, symmetric with `area` above — assunto and área
// never require each other, or matéria's own assunto/área picks, to work.
export const listBankAreasForSubject = (importSubject: string, topic: string | null = null): Promise<BankFacetOption[]> =>
  withBankFallback(() => bankRpc<BankFacetOption[]>('bank_areas', { p_subject: importSubject, p_topic: topic }), () => listBankAreasForSubjectFirestore(importSubject, topic));
const listBankAreasForSubjectFirestore = async (importSubject: string, topic: string | null = null): Promise<BankFacetOption[]> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, topic, null)));
  return countByField(snap.docs, 'position');
};

// Live count for the exact matéria + assunto + área combination currently
// selected — assunto and área are independent facets (each counted only
// against the matéria on their own in listBankTopicsForSubject/
// listBankAreasForSubject above), so when both are set at once their real
// overlap can only be known by asking Firestore directly.
export const countBankQuestions = (importSubject: string, topic: string | null, area: string | null): Promise<number> =>
  withBankFallback(async () => Number(await bankRpc<number>('bank_count', { p_subject: importSubject, p_topic: topic, p_area: area })), () => countBankQuestionsFirestore(importSubject, topic, area));
const countBankQuestionsFirestore = async (importSubject: string, topic: string | null, area: string | null): Promise<number> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, topic, area)));
  return snap.size;
};

export const fetchBankQuestions = (importSubject: string, topic: string | null, area: string | null, count: number): Promise<QuizQuestion[]> =>
  withBankFallback(async () => {
    const rows = await bankRpc<BankRow[]>('bank_random', { p_subject: importSubject, p_topic: topic, p_area: area, p_count: count });
    if (rows.length === 0) throw new Error('Nenhuma questão encontrada para essa matéria/assunto/área no nosso banco ainda.');
    return rows.map(fromBankRow).map(mapBankQuestion);
  }, () => fetchBankQuestionsFirestore(importSubject, topic, area, count));
const fetchBankQuestionsFirestore = async (
  importSubject: string,
  topic: string | null,
  area: string | null,
  count: number
): Promise<QuizQuestion[]> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, topic, area)));
  const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PublishedQuestion, 'id'>) }));
  if (all.length === 0) {
    throw new Error('Nenhuma questão encontrada para essa matéria/assunto/área no nosso banco ainda.');
  }
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(mapBankQuestion);
};

// --- Banco geral por prova oficial (banca / órgão / cargo / ano) ---
// A general, source-agnostic filter path over the SAME `questions`
// collection — orthogonal to importSubject/subjectRaw above. Any source
// that fills in examBoard/organization/position/examYear (currently only
// worker/exam_discovery) becomes browsable this way, independent of
// whether it was ever tagged with a matéria. Meant to be reused by every
// feature that offers "estudar por questões", not just this file's own
// CONCURSO tab.
//
// Full-collection scans, same tradeoff/justification as the matéria
// facets above: fine at the bank's current size, revisit if it grows into
// the thousands.

const nonEmpty = (value: unknown): value is string | number => value !== null && value !== undefined && value !== '';

// "Todas as bancas / órgãos / cargos / anos": o valor especial abaixo no lugar de um item da lista. As funções do banco (bank_exam_*) só aceitam
// igualdade, então quando algum nível é "todos" as listas e a busca saem de uma leitura direta da tabela (só as 4 colunas, uma vez por sessão).
export const EXAM_ALL = '__todas__';
export const isExamAll = (value: string) => value === EXAM_ALL;
type ExamRow = { exam_board: string | null; organization: string | null; position: string | null; exam_year: number | null; import_subject: string | null; subject_raw: string | null };
let examRowsPromise: Promise<ExamRow[]> | null = null;
const loadExamRows = (): Promise<ExamRow[]> => {
  if (!examRowsPromise) {
    examRowsPromise = (async () => {
      const rows: ExamRow[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data } = await bankSelect<ExamRow[]>(`questoes?select=exam_board,organization,position,exam_year,import_subject,subject_raw&order=id&offset=${offset}&limit=1000`);
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    })().catch((error) => { examRowsPromise = null; throw error; });
  }
  return examRowsPromise;
};
const facetOf = (rows: ExamRow[], pick: (r: ExamRow) => string | number | null, year = false): BankFacetOption[] => {
  const counts = new Map<string, number>();
  rows.forEach((r) => { const v = pick(r); if (v !== null && v !== undefined && String(v).trim() !== '') counts.set(String(v), (counts.get(String(v)) ?? 0) + 1); });
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => (year ? Number(b.value) - Number(a.value) : a.value.localeCompare(b.value, 'pt-BR')));
};
const withAll = (options: BankFacetOption[], label: string, total?: number): BankFacetOption[] =>
  options.length === 0 ? options : [{ value: EXAM_ALL, label, count: total ?? options.reduce((n, o) => n + o.count, 0) }, ...options];
// Total de "todos": as questões que realmente passam pelos níveis acima (inclui as sem órgão/cargo/ano informados), não a soma das opções.
const totalOf = (board: string, institution?: string, position?: string): Promise<number | undefined> =>
  loadExamRows().then((rows) => matchRows(rows, board, institution, position).length).catch(() => undefined);
const matchRows = (rows: ExamRow[], board: string, institution?: string, position?: string, year?: number | string, subject?: string, topic?: string) => rows.filter((r) =>
  (isExamAll(board) || r.exam_board === board) && (!institution || isExamAll(institution) || r.organization === institution) &&
  (!position || isExamAll(position) || r.position === position) && (year === undefined || isExamAll(String(year)) || r.exam_year === Number(year)) &&
  (!subject || isExamAll(subject) || r.import_subject === subject) && (!topic || isExamAll(topic) || r.subject_raw === topic));

// Matéria e assunto dentro da prova escolhida (os níveis de cima podem estar em "todos").
export const listExamSubjects = async (board: string, institution: string, position: string, year: number | string): Promise<BankFacetOption[]> => {
  const rows = matchRows(await loadExamRows(), board, institution, position, year);
  return withAll(facetOf(rows, (r) => r.import_subject), 'Todas as matérias', rows.length);
};
export const listExamTopics = async (board: string, institution: string, position: string, year: number | string, subject: string): Promise<BankFacetOption[]> => {
  const rows = matchRows(await loadExamRows(), board, institution, position, year, subject);
  return withAll(facetOf(rows, (r) => r.subject_raw), 'Todos os assuntos', rows.length);
};
export const countExamQuestions = async (board: string, institution: string, position: string, year: number | string, subject: string, topic: string): Promise<number> =>
  matchRows(await loadExamRows(), board, institution, position, year, subject, topic).length;

export const listExamBoards = async (): Promise<BankFacetOption[]> => {
  const boards = await withBankFallback(() => bankRpc<BankFacetOption[]>('bank_exam_boards'), listExamBoardsFirestore);
  // O total de "todas as bancas" inclui as questões sem banca informada.
  const total = await loadExamRows().then((rows) => rows.length).catch(() => undefined);
  return withAll(boards, 'Todas as bancas', total);
};
const listExamBoardsFirestore = async (): Promise<BankFacetOption[]> => {
  const snap = await getDocs(collection(db, 'questions'));
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const board = (d.data() as PublishedQuestion).examBoard;
    if (nonEmpty(board)) counts.set(board, (counts.get(board) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};

export const listExamInstitutions = async (board: string): Promise<BankFacetOption[]> => {
  if (isExamAll(board)) return withAll(facetOf(await loadExamRows(), (r) => r.organization), 'Todos os órgãos', await totalOf(board));
  return withAll(await withBankFallback(() => bankRpc<BankFacetOption[]>('bank_exam_institutions', { p_board: board }), () => listExamInstitutionsFirestore(board)), 'Todos os órgãos', await totalOf(board));
};
const listExamInstitutionsFirestore = async (board: string): Promise<BankFacetOption[]> => {
  const snap = await getDocs(query(collection(db, 'questions'), where('examBoard', '==', board)));
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const institution = (d.data() as PublishedQuestion).organization;
    if (nonEmpty(institution)) counts.set(institution, (counts.get(institution) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};

export const listExamPositions = async (board: string, institution: string): Promise<BankFacetOption[]> => {
  if (isExamAll(board) || isExamAll(institution)) return withAll(facetOf(matchRows(await loadExamRows(), board, institution), (r) => r.position), 'Todos os cargos', await totalOf(board, institution));
  return withAll(await withBankFallback(() => bankRpc<BankFacetOption[]>('bank_exam_positions', { p_board: board, p_institution: institution }), () => listExamPositionsFirestore(board, institution)), 'Todos os cargos', await totalOf(board, institution));
};
const listExamPositionsFirestore = async (board: string, institution: string): Promise<BankFacetOption[]> => {
  const snap = await getDocs(
    query(collection(db, 'questions'), where('examBoard', '==', board), where('organization', '==', institution))
  );
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const position = (d.data() as PublishedQuestion).position;
    if (nonEmpty(position)) counts.set(position, (counts.get(position) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
};

// Level 4 (ano) doubles as "how many questions exist for this exact
// banca/órgão/cargo/ano" via BankFacetOption.count — same role
// bankTopicsTotal/bankAvailableCount play for the matéria path.
export const listExamYears = async (board: string, institution: string, position: string): Promise<BankFacetOption[]> => {
  if (isExamAll(board) || isExamAll(institution) || isExamAll(position)) return withAll(facetOf(matchRows(await loadExamRows(), board, institution, position), (r) => r.exam_year, true), 'Todos os anos', await totalOf(board, institution, position));
  return withAll(await withBankFallback(() => bankRpc<BankFacetOption[]>('bank_exam_years', { p_board: board, p_institution: institution, p_position: position }), () => listExamYearsFirestore(board, institution, position)), 'Todos os anos', await totalOf(board, institution, position));
};
const listExamYearsFirestore = async (board: string, institution: string, position: string): Promise<BankFacetOption[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'questions'),
      where('examBoard', '==', board),
      where('organization', '==', institution),
      where('position', '==', position)
    )
  );
  const counts = new Map<number, number>();
  snap.docs.forEach(d => {
    const year = (d.data() as PublishedQuestion).examYear;
    if (nonEmpty(year)) counts.set(year, (counts.get(year) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([year, count]) => ({ value: String(year), count }))
    .sort((a, b) => Number(b.value) - Number(a.value)); // most recent exam first
};

const fetchExamQuestionsAll = async (board: string, institution: string, position: string, year: number | string, count: number, subject: string = EXAM_ALL, topic: string = EXAM_ALL): Promise<QuizQuestion[]> => {
  const filters = [['exam_board', board], ['organization', institution], ['position', position], ['exam_year', year], ['import_subject', subject], ['subject_raw', topic]]
    .filter(([, v]) => !isExamAll(String(v))).map(([k, v]) => `${k}=eq.${encodeURIComponent(String(v))}`).join('&');
  const base = `questoes?select=*${filters ? `&${filters}` : ''}&order=id`;
  const head = await bankSelect<unknown[]>(`${base}&limit=1`, { Prefer: 'count=exact', Range: '0-0' });
  const total = Number((head.response.headers.get('content-range') ?? '').split('/')[1]) || 0;
  if (!total) throw new Error('Nenhuma questão encontrada para esse filtro no nosso banco ainda.');
  const window = Math.max(count * 8, 80);
  const from = Math.floor(Math.random() * Math.max(1, total - window + 1));
  const { data } = await bankSelect<BankRow[]>(`${base}&offset=${from}&limit=${window}`);
  return data.sort(() => Math.random() - 0.5).slice(0, count).map(fromBankRow).map(mapBankQuestion);
};

export const fetchExamQuestions = (board: string, institution: string, position: string, year: number | string, count: number, subject: string = EXAM_ALL, topic: string = EXAM_ALL): Promise<QuizQuestion[]> =>
  [board, institution, position, String(year), subject, topic].some(isExamAll) ? fetchExamQuestionsAll(board, institution, position, year, count, subject, topic) :
  withBankFallback(async () => {
    const rows = await bankRpc<BankRow[]>('bank_exam_random', { p_board: board, p_institution: institution, p_position: position, p_year: year, p_count: count });
    if (rows.length === 0) throw new Error('Nenhuma questão encontrada para essa banca/órgão/cargo/ano no nosso banco ainda.');
    return rows.map(fromBankRow).map(mapBankQuestion);
  }, () => fetchExamQuestionsFirestore(board, institution, position, Number(year), count));
const fetchExamQuestionsFirestore = async (
  board: string,
  institution: string,
  position: string,
  year: number,
  count: number
): Promise<QuizQuestion[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'questions'),
      where('examBoard', '==', board),
      where('organization', '==', institution),
      where('position', '==', position),
      where('examYear', '==', year)
    )
  );
  const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PublishedQuestion, 'id'>) }));
  if (all.length === 0) {
    throw new Error('Nenhuma questão encontrada para essa banca/órgão/cargo/ano no nosso banco ainda.');
  }
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(mapBankQuestion);
};

// --- Package publish (admin): a JSON package built outside the app (montar_banco_reais.py) goes straight to `questions`. ---
// The Admin-SDK push script needs a billed Google Cloud project; this path only needs the admin's own sign-in, because
// firestore.rules already lets an admin create published questions. Nothing is overwritten: a question whose id or
// contentHash already exists is skipped.

export interface PackageQuestion {
  source: string;
  externalId: string;
  importSubject?: string | null;
  questionType: QuestionType;
  subjectRaw?: string | null;
  topicRaw?: string | null;
  statement: string;
  alternatives: QuestionAlternative[];
  correctLetter: string;
  explanation: string;
  contentHash: string;
  examBoard?: string | null;
  organization?: string | null;
  position?: string | null;
  examYear?: number | null;
}

const packageDocId = (q: Pick<PackageQuestion, 'source' | 'externalId'>) =>
  `${q.source}_${q.externalId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 1400);

// Same structural bar as worker/lib/validation.py: 2–5 alternatives, unique letters, exactly one correct, key consistent.
export const parsePackage = (raw: unknown): { questions: PackageQuestion[]; problems: string[] } => {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return { questions: [], problems: ['O arquivo não tem a lista "questions".'] };
  const questions: PackageQuestion[] = [];
  const problems: string[] = [];
  list.forEach((item: any, index) => {
    const alts: any[] = Array.isArray(item?.alternatives) ? item.alternatives : [];
    const letters = alts.map(a => a?.letter);
    const why =
      typeof item?.source !== 'string' || typeof item?.externalId !== 'string' ? 'sem source/externalId'
      : typeof item?.statement !== 'string' || !item.statement.trim() || item.statement.length > 20000 ? 'enunciado inválido'
      : alts.length < 2 || alts.length > 5 ? 'número de alternativas inválido'
      : new Set(letters).size !== letters.length || alts.some(a => typeof a?.text !== 'string' || !a.text.trim()) ? 'alternativas repetidas ou vazias'
      : !letters.includes(item.correctLetter) || alts.filter(a => a.isCorrect).length !== 1 || alts.find(a => a.isCorrect)?.letter !== item.correctLetter ? 'gabarito inconsistente'
      : typeof item?.explanation !== 'string' || item.explanation.length > 20000 ? 'explicação inválida'
      : typeof item?.contentHash !== 'string' ? 'sem contentHash'
      : null;
    if (why) problems.push(`#${index + 1}: ${why}`);
    else questions.push(item as PackageQuestion);
  });
  return { questions, problems };
};

const inChunks = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// Which questions of the package are already in the bank (same doc id or same statement hash).
export const findPackageDuplicates = async (questions: PackageQuestion[]): Promise<Set<string>> => {
  const duplicated = new Set<string>();
  const byId = new Map(questions.map(q => [packageDocId(q), q]));
  const byHash = new Map<string, PackageQuestion[]>();
  questions.forEach(q => byHash.set(q.contentHash, [...(byHash.get(q.contentHash) ?? []), q]));
  for (const ids of inChunks([...byId.keys()], 30)) {
    const snap = await getDocs(query(collection(db, 'questions'), where(documentId(), 'in', ids)));
    snap.docs.forEach(d => duplicated.add(d.id));
  }
  for (const hashes of inChunks([...byHash.keys()], 30)) {
    const snap = await getDocs(query(collection(db, 'questions'), where('contentHash', 'in', hashes)));
    snap.docs.forEach(d => (byHash.get((d.data() as PublishedQuestion).contentHash) ?? []).forEach(q => duplicated.add(packageDocId(q))));
  }
  return duplicated;
};

export const publishPackage = async (
  questions: PackageQuestion[],
  approvedBy: string,
  onProgress?: (done: number, total: number) => void,
): Promise<number> => {
  const seen = new Set<string>();
  const unique = questions.filter(q => { const id = packageDocId(q); if (seen.has(id)) return false; seen.add(id); return true; });
  let done = 0;
  for (const chunk of inChunks(unique, 400)) {
    const batch = writeBatch(db);
    chunk.forEach(q => {
      const published: Omit<PublishedQuestion, 'id'> = {
        source: q.source,
        externalId: q.externalId,
        importSubject: q.importSubject,
        questionType: q.questionType,
        subjectRaw: q.subjectRaw ?? null,
        topicRaw: q.topicRaw ?? null,
        statement: q.statement,
        alternatives: q.alternatives,
        correctLetter: q.correctLetter,
        explanation: q.explanation,
        contentHash: q.contentHash,
        approvedAt: Date.now(),
        approvedBy,
        examBoard: q.examBoard,
        organization: q.organization,
        position: q.position,
        examYear: q.examYear,
      };
      batch.set(doc(db, 'questions', packageDocId(q)), cleanData(published));
    });
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, unique.length);
  }
  return done;
};
