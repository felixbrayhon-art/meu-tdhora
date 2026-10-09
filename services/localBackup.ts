// Full backup of what the app keeps in this browser (localStorage and IndexedDB), so the
// student can move to another address or device. Browser data is tied to the site's
// address, so without this a new host would open empty.

const FORMAT = 'tdhora-backup';
const VERSION = 1;
// Firebase keeps the login session in these; the student signs in again on the new address.
const SKIP_DATABASES = /^(firebase|firestore)/i;
const SKIP_KEYS = /^firebase:/i;

interface StoreDump {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: { name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }[];
  // Out-of-line keys are kept beside each value.
  records: { key?: unknown; value: unknown }[];
}

interface DatabaseDump {
  name: string;
  version: number;
  stores: StoreDump[];
}

export interface BackupFile {
  format: typeof FORMAT;
  version: number;
  createdAt: string;
  origin: string;
  localStorage: Record<string, string>;
  indexedDB: DatabaseDump[];
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

const base64ToBytes = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

// IndexedDB values can hold Blobs (PDFs, images), binary buffers and Dates, which JSON cannot.
const encode = async (value: unknown): Promise<unknown> => {
  if (value instanceof Blob) {
    return { __tdhBlob: await blobToDataUrl(value), type: value.type, name: value instanceof File ? value.name : undefined };
  }
  if (value instanceof ArrayBuffer) return { __tdhBuffer: bytesToBase64(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) return { __tdhBytes: bytesToBase64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)), kind: value.constructor.name };
  if (value instanceof Date) return { __tdhDate: value.toISOString() };
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encode(v);
    return out;
  }
  return value;
};

const decode = async (value: unknown): Promise<unknown> => {
  if (Array.isArray(value)) return Promise.all(value.map(decode));
  if (value && typeof value === 'object') {
    const v = value as Record<string, any>;
    if (typeof v.__tdhBlob === 'string') {
      const blob = await (await fetch(v.__tdhBlob)).blob();
      return v.name ? new File([blob], v.name, { type: v.type || blob.type }) : new Blob([blob], { type: v.type || blob.type });
    }
    if (typeof v.__tdhBuffer === 'string') return base64ToBytes(v.__tdhBuffer).buffer;
    if (typeof v.__tdhBytes === 'string') {
      const bytes = base64ToBytes(v.__tdhBytes);
      const Ctor = (globalThis as any)[v.kind];
      return typeof Ctor === 'function' && Ctor !== Uint8Array ? new Ctor(bytes.buffer) : bytes;
    }
    if (typeof v.__tdhDate === 'string') return new Date(v.__tdhDate);
    const out: Record<string, unknown> = {};
    for (const [k, inner] of Object.entries(v)) out[k] = await decode(inner);
    return out;
  }
  return value;
};

const promisify = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const openExisting = (name: string) => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(name);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Feche outras abas do ToDaHORA e tente de novo.'));
});

const dumpDatabase = async (name: string): Promise<DatabaseDump> => {
  const db = await openExisting(name);
  try {
    const stores: StoreDump[] = [];
    for (const storeName of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const [values, keys] = await Promise.all([promisify(store.getAll()), promisify(store.getAllKeys())]);
      const records = [];
      for (let i = 0; i < values.length; i++) {
        records.push(store.keyPath === null ? { key: keys[i], value: await encode(values[i]) } : { value: await encode(values[i]) });
      }
      stores.push({
        name: storeName,
        keyPath: store.keyPath as string | string[] | null,
        autoIncrement: store.autoIncrement,
        indexes: Array.from(store.indexNames).map((indexName) => {
          const index = store.index(indexName);
          return { name: indexName, keyPath: index.keyPath as string | string[], unique: index.unique, multiEntry: index.multiEntry };
        }),
        records,
      });
    }
    return { name, version: db.version, stores };
  } finally {
    db.close();
  }
};

export const createBackup = async (): Promise<BackupFile> => {
  const local: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !SKIP_KEYS.test(key)) local[key] = localStorage.getItem(key) ?? '';
  }
  const databases: DatabaseDump[] = [];
  const list = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
  for (const info of list) {
    if (!info.name || SKIP_DATABASES.test(info.name)) continue;
    databases.push(await dumpDatabase(info.name));
  }
  return { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), origin: location.origin, localStorage: local, indexedDB: databases };
};

export const downloadBackup = async (): Promise<{ bytes: number }> => {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todahora-backup-${backup.createdAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { bytes: blob.size };
};

const restoreDatabase = async (dump: DatabaseDump) => {
  // Create the database and any missing stores with the original layout, then write the records.
  // A brand-new database gets the original version number, so the app's own open() call
  // (which asks for that exact version) keeps working afterwards.
  const existing = typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).some((d) => d.name === dump.name) : true;
  let version = dump.version;
  if (existing) {
    const current = await openExisting(dump.name);
    const missing = dump.stores.some((s) => !current.objectStoreNames.contains(s.name));
    version = Math.max(current.version + (missing ? 1 : 0), dump.version);
    current.close();
  }
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dump.name, version);
    request.onupgradeneeded = () => {
      const upgrading = request.result;
      for (const s of dump.stores) {
        if (upgrading.objectStoreNames.contains(s.name)) continue;
        const store = upgrading.createObjectStore(s.name, { keyPath: s.keyPath ?? undefined, autoIncrement: s.autoIncrement });
        for (const index of s.indexes) store.createIndex(index.name, index.keyPath, { unique: index.unique, multiEntry: index.multiEntry });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas do ToDaHORA e tente de novo.'));
  });
  try {
    for (const s of dump.stores) {
      const values = await Promise.all(s.records.map(async (r) => ({ key: r.key === undefined ? undefined : await decode(r.key), value: await decode(r.value) })));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(s.name, 'readwrite');
        const store = tx.objectStore(s.name);
        for (const r of values) {
          if (store.keyPath === null && r.key !== undefined) store.put(r.value, r.key as IDBValidKey);
          else store.put(r.value);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    }
  } finally {
    db.close();
  }
};

export const readBackupFile = async (file: File): Promise<BackupFile> => {
  let parsed: any;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Este arquivo não é um backup do ToDaHORA.');
  }
  if (parsed?.format !== FORMAT || typeof parsed.localStorage !== 'object' || !Array.isArray(parsed.indexedDB)) {
    throw new Error('Este arquivo não é um backup do ToDaHORA.');
  }
  return parsed as BackupFile;
};

/** Writes the backup into this browser. Existing items with the same key are replaced. */
export const restoreBackup = async (backup: BackupFile) => {
  for (const [key, value] of Object.entries(backup.localStorage)) {
    if (!SKIP_KEYS.test(key)) localStorage.setItem(key, value);
  }
  for (const dump of backup.indexedDB) {
    if (!SKIP_DATABASES.test(dump.name)) await restoreDatabase(dump);
  }
};

export const backupSummary = (backup: BackupFile) => ({
  keys: Object.keys(backup.localStorage).length,
  records: backup.indexedDB.reduce((sum, db) => sum + db.stores.reduce((s, st) => s + st.records.length, 0), 0),
  createdAt: new Date(backup.createdAt),
  origin: backup.origin,
});
