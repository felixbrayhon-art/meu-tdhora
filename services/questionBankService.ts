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
  const topic = [q.subjectRaw, q.topicRaw].filter(Boolean).join(' · ');
  return {
    id: `bank-${q.id}`,
    question: `<p>${escapeHtml(q.statement)}</p>`,
    options: sortedAlternatives.map(a => a.text),
    correctAnswer: Math.max(0, correctIndex),
    explanation: q.explanation,
    topic: topic || 'Nosso Banco de Questões',
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

// Level 2: FC Concursos' own (finer) classification within that discipline
// (subjectRaw) — only fetched once a level-1 matéria has been chosen.
// `total` is the count for "Todos os assuntos" (every question under this
// matéria, including any with no subjectRaw at all).
export const listBankTopicsForSubject = async (importSubject: string): Promise<BankTopicFacets> => {
  const snap = await getDocs(query(collection(db, 'questions'), where('importSubject', '==', importSubject)));
  const counts = new Map<string, number>();
  snap.docs.forEach(d => {
    const topic = (d.data() as PublishedQuestion).subjectRaw;
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
  });
  const topics = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
  return { total: snap.size, topics };
};

export const fetchBankQuestions = async (
  importSubject: string,
  topic: string | null,
  count: number
): Promise<QuizQuestion[]> => {
  const constraints = [where('importSubject', '==', importSubject)];
  if (topic) constraints.push(where('subjectRaw', '==', topic));
  const snap = await getDocs(query(collection(db, 'questions'), ...constraints));
  const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PublishedQuestion, 'id'>) }));
  if (all.length === 0) {
    throw new Error('Nenhuma questão encontrada para essa matéria/assunto no nosso banco ainda.');
  }
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(mapBankQuestion);
};
