const DB_NAME = 'legalpm-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

interface StoredFile {
  path: string;
  data: ArrayBuffer;
  type: string;
  size: number;
  createdAt: string;
}

function openFileDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFile(path: string, file: File | Blob): Promise<void> {
  const db = await openFileDb();
  const buffer = await file.arrayBuffer();
  const record: StoredFile = {
    path,
    data: buffer,
    type: file.type || 'application/octet-stream',
    size: buffer.byteLength,
    createdAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFile(path: string): Promise<{ blob: Blob; type: string } | null> {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(path);
    request.onsuccess = () => {
      const record = request.result as StoredFile | undefined;
      if (!record) return resolve(null);
      resolve({ blob: new Blob([record.data], { type: record.type }), type: record.type });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFile(path: string): Promise<void> {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getFileUrl(path: string): Promise<string | null> {
  return getFile(path).then(f => f ? URL.createObjectURL(f.blob) : null);
}

export async function clearFileStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function createBucketAdapter(_bucket: string) {
  return {
    async upload(path: string, file: File | Blob) {
      try {
        await storeFile(path, file);
        return { data: { path }, error: null };
      } catch (e) {
        return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    async createSignedUrl(path: string, _expiresIn: number) {
      const url = await getFileUrl(path);
      if (!url) return { data: null, error: new Error('File not found') };
      return { data: { signedUrl: url }, error: null };
    },
    async remove(paths: string[]) {
      try {
        for (const p of paths) await deleteFile(p);
        return { data: paths.map(p => ({ name: p })), error: null };
      } catch (e) {
        return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
      }
    },
    async download(path: string) {
      const f = await getFile(path);
      if (!f) return { data: null, error: new Error('File not found') };
      return { data: f.blob, error: null };
    },
  };
}

export const localStorage = {
  from(bucket: string) {
    return createBucketAdapter(bucket);
  },
};
