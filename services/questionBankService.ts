import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, cleanData } from '../src/lib/firebase';
import { PublishedQuestion, QuestionDraft, QuestionImportBatch, QuizQuestion } from '../types';

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
}

export interface BankTopicFacets {
  total: number;
  topics: BankFacetOption[];
}

// Level 1: the main discipline chosen at import time (importSubject) —
// "Direito Penal", "Direito Constitucional" etc.
export const listBankImportSubjects = async (): Promise<BankFacetOption[]> => {
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
export const listBankTopicsForSubject = async (importSubject: string, area: string | null = null): Promise<BankTopicFacets> => {
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
export const listBankAreasForSubject = async (importSubject: string, topic: string | null = null): Promise<BankFacetOption[]> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, topic, null)));
  return countByField(snap.docs, 'position');
};

// Live count for the exact matéria + assunto + área combination currently
// selected — assunto and área are independent facets (each counted only
// against the matéria on their own in listBankTopicsForSubject/
// listBankAreasForSubject above), so when both are set at once their real
// overlap can only be known by asking Firestore directly.
export const countBankQuestions = async (importSubject: string, topic: string | null, area: string | null): Promise<number> => {
  const snap = await getDocs(query(collection(db, 'questions'), ...buildBankConstraints(importSubject, topic, area)));
  return snap.size;
};

export const fetchBankQuestions = async (
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

export const listExamBoards = async (): Promise<BankFacetOption[]> => {
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

export const fetchExamQuestions = async (
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
