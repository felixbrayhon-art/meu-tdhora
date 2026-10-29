import type { InkNotebook, InkPage, PageSize, PaperColor, PaperTemplate } from './types';

// Cadernos guardados no IndexedDB: o localStorage (≈5 MB) não comporta traços de tinta nem PDFs.
const DB = 'todahora-ink';
const STORE = 'notebooks';
const BLOBS = 'blobs';
const FN = 'fnotebooks';

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 3);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    if (!db.objectStoreNames.contains(FN)) db.createObjectStore(FN, { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const run = async <T,>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
};

// Cadernos salvos antes de os papéis seguirem o OwlLuna usavam outros nomes.
const OLD_TEMPLATE: Record<string, PaperTemplate> = { lined: 'narrowRuled', 'lined-wide': 'wideRuled', 'grid-large': 'grid', dots: 'dotted', 'planner-weekly': 'weekPlanner', 'planner-daily': 'dayPlanner', todo: 'checklist', graph: 'engineering', handwriting: 'penmanship' };
const OLD_PAPER: Record<string, PaperColor> = { cream: 'ivory', green: 'sage', blue: 'gray', pink: 'blush', grey: 'gray', dark: 'charcoal', black: 'charcoal' };
const migrate = (nb: InkNotebook | undefined): InkNotebook | undefined => nb && ({
  ...nb,
  pages: nb.pages.map((p) => ({ ...p, template: OLD_TEMPLATE[p.template as string] ?? p.template, paper: OLD_PAPER[p.paper as string] ?? p.paper, size: ((p.size as string) === 'wide' ? 'widescreen' : p.size) as PageSize })),
});
export const loadNotebook = async (id: string): Promise<InkNotebook | undefined> => migrate(await run<InkNotebook | undefined>(STORE, 'readonly', (s) => s.get(id)));
export const saveNotebook = (nb: InkNotebook): Promise<IDBValidKey> => run(STORE, 'readwrite', (s) => s.put(nb));
export const deleteNotebook = (id: string): Promise<undefined> => run<undefined>(STORE, 'readwrite', (s) => s.delete(id));
export const listNotebooks = (): Promise<InkNotebook[]> => run<InkNotebook[]>(STORE, 'readonly', (s) => s.getAll());

export const putBlob = (key: string, blob: Blob): Promise<IDBValidKey> => run(BLOBS, 'readwrite', (s) => s.put(blob, key));
export const getBlob = (key: string): Promise<Blob | undefined> => run<Blob | undefined>(BLOBS, 'readonly', (s) => s.get(key));
export const deleteBlob = (key: string): Promise<undefined> => run<undefined>(BLOBS, 'readwrite', (s) => s.delete(key));

export const newPageId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const newPage = (template: PaperTemplate = 'narrowRuled', paper: PaperColor = 'ivory', size: PageSize = 'a4'): InkPage => ({ id: newPageId(), template, paper, size, strokes: [] });

// Cadernos do motor do FineNotes: o documento inteiro como texto comprimido (DocumentEncoder), uma linha por caderno.
export interface FnRecord { id: string; payload: string; updatedAt: number }
export const loadFnNotebook = (id: string): Promise<FnRecord | undefined> => run<FnRecord | undefined>(FN, 'readonly', (s) => s.get(id));
export const saveFnNotebook = (rec: FnRecord): Promise<IDBValidKey> => run(FN, 'readwrite', (s) => s.put(rec));
export const deleteFnNotebook = (id: string): Promise<undefined> => run<undefined>(FN, 'readwrite', (s) => s.delete(id));
