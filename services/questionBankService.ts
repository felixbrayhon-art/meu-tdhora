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
import { PublishedQuestion, QuestionDraft, QuestionImportBatch } from '../types';

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
