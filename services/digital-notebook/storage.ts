import type { DigitalNotebook } from './model';

const DATABASE = 'tdhora_digital_notebooks';
const STORE = 'notebooks';
const unsaved = new Map<string, DigitalNotebook>();
const draftKey = (owner: string, id: string) => `${owner}/${id}`;
if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => {
  if (unsaved.size) { event.preventDefault(); event.returnValue = ''; }
});

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['owner', 'id'] });
      store.createIndex('owner', 'owner');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas do TDHORA para abrir o caderno.'));
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => {
      db.close();
      reject(transaction.error || request.error || new Error('Não foi possível salvar neste navegador.'));
    };
  });
}

export async function listNotebooks(owner: string): Promise<DigitalNotebook[]> {
  const notes: DigitalNotebook[] = await transact('readonly', store => store.index('owner').getAll(owner));
  const merged = new Map(notes.map(note => [note.id, note]));
  for (const note of unsaved.values()) if (note.owner === owner) merged.set(note.id, note);
  return [...merged.values()];
}
export const hasUnsavedNotebook = (owner: string, id: string) => unsaved.has(draftKey(owner, id));

// Serialize writes so a slower older save cannot replace a newer edit.
let writeQueue: Promise<unknown> = Promise.resolve();
export function saveNotebook(notebook: DigitalNotebook): Promise<unknown> {
  const key = draftKey(notebook.owner, notebook.id);
  unsaved.set(key, notebook);
  writeQueue = writeQueue.catch(() => undefined).then(() => transact('readwrite', store => store.put(notebook))).then(result => {
    if (unsaved.get(key) === notebook) unsaved.delete(key);
    return result;
  });
  return writeQueue;
}
export function deleteNotebook(owner: string, id: string): Promise<unknown> {
  writeQueue = writeQueue.catch(() => undefined).then(() => transact('readwrite', store => store.delete([owner, id]))).then(result => {
    unsaved.delete(draftKey(owner, id));
    return result;
  });
  return writeQueue;
}
