import type { InkNotebook, InkPage, PageSize, PaperColor, PaperTemplate } from './types';

// Cadernos guardados no IndexedDB: o localStorage (≈5 MB) não comporta traços de tinta nem PDFs.
const DB = 'todahora-ink';
const STORE = 'notebooks';
const BLOBS = 'blobs';

const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB, 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
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

export const loadNotebook = (id: string): Promise<InkNotebook | undefined> => run<InkNotebook | undefined>(STORE, 'readonly', (s) => s.get(id));
export const saveNotebook = (nb: InkNotebook): Promise<IDBValidKey> => run(STORE, 'readwrite', (s) => s.put(nb));
export const deleteNotebook = (id: string): Promise<undefined> => run<undefined>(STORE, 'readwrite', (s) => s.delete(id));
export const listNotebooks = (): Promise<InkNotebook[]> => run<InkNotebook[]>(STORE, 'readonly', (s) => s.getAll());

export const putBlob = (key: string, blob: Blob): Promise<IDBValidKey> => run(BLOBS, 'readwrite', (s) => s.put(blob, key));
export const getBlob = (key: string): Promise<Blob | undefined> => run<Blob | undefined>(BLOBS, 'readonly', (s) => s.get(key));
export const deleteBlob = (key: string): Promise<undefined> => run<undefined>(BLOBS, 'readwrite', (s) => s.delete(key));

export const newPageId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const newPage = (template: PaperTemplate = 'lined', paper: PaperColor = 'cream', size: PageSize = 'a4'): InkPage => ({ id: newPageId(), template, paper, size, strokes: [] });
