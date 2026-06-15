import { PGlite } from '@electric-sql/pglite';

let dbInstance: PGlite | null = null;
let dbReady: Promise<PGlite> | null = null;

const DATA_DIR = 'idb://legalpm-local';

export async function getDb(): Promise<PGlite> {
  if (dbInstance?.ready) return dbInstance;
  if (dbReady) return dbReady;

  dbReady = initDb();
  return dbReady;
}

async function initDb(): Promise<PGlite> {
  const db = await PGlite.create(DATA_DIR, {
    relaxedDurability: true,
  });

  const needsInit = await checkSchemaVersion(db);
  if (needsInit) {
    const { runMigrations } = await import('./schema');
    await runMigrations(db);
  }

  await requestPersistentStorage();

  dbInstance = db;
  return db;
}

async function checkSchemaVersion(db: PGlite): Promise<boolean> {
  try {
    const result = await db.query<{ version: number }>(
      `SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1`
    );
    if (result.rows.length === 0) return true;
    const { SCHEMA_VERSION } = await import('./schema');
    return result.rows[0].version < SCHEMA_VERSION;
  } catch {
    return true;
  }
}

async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist) {
      const persisted = await navigator.storage.persisted();
      if (!persisted) {
        await navigator.storage.persist();
      }
    }
  } catch {
    // Best effort — not available in all browsers
  }
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    dbReady = null;
  }
}

export async function resetDb(): Promise<void> {
  await closeDb();
  if (typeof indexedDB !== 'undefined') {
    const dbName = DATA_DIR.replace('idb://', '');
    indexedDB.deleteDatabase(`/pglite/${dbName}`);
  }
  dbInstance = null;
  dbReady = null;
}

export async function exportDatabase(): Promise<Blob> {
  const db = await getDb();
  const dump = await db.dumpDataDir('gzip');
  return dump instanceof File ? dump : dump as Blob;
}

export async function importDatabase(data: Blob): Promise<void> {
  await closeDb();
  if (typeof indexedDB !== 'undefined') {
    const dbName = DATA_DIR.replace('idb://', '');
    indexedDB.deleteDatabase(`/pglite/${dbName}`);
  }

  const db = await PGlite.create(DATA_DIR, {
    relaxedDurability: true,
    loadDataDir: data,
  });

  dbInstance = db;
  dbReady = Promise.resolve(db);
}
