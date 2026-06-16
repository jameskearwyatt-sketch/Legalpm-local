import { PGlite } from '@electric-sql/pglite';

let dbInstance: PGlite | null = null;
let dbReady: Promise<PGlite> | null = null;

const DATA_DIR = 'idb://legalpm-local';

// PGlite parses date/timestamp columns into JS Date objects by default, but the
// rest of the app (carried over from the Supabase REST API) expects ISO strings
// — e.g. it calls parseISO() on them. Override the parsers so these types come
// back as strings, matching the old cloud behaviour:
//   - date (1082):        plain "YYYY-MM-DD" (NOT converted through UTC, so
//                         date-only values like billing dates never shift a day)
//   - timestamp (1114):   "YYYY-MM-DDTHH:MM:SS" (no offset, treated as local)
//   - timestamptz (1184): "YYYY-MM-DDTHH:MM:SS+00:00" (PGlite emits UTC)
const DATE_TIME_PARSERS = {
  1082: (value: string) => value,
  1114: (value: string) => value.replace(' ', 'T'),
  1184: (value: string) =>
    value.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'),
};

export async function getDb(): Promise<PGlite> {
  if (dbInstance?.ready) return dbInstance;
  if (dbReady) return dbReady;

  dbReady = initDb();
  return dbReady;
}

async function initDb(): Promise<PGlite> {
  const db = await PGlite.create(DATA_DIR, {
    relaxedDurability: true,
    parsers: DATE_TIME_PARSERS,
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
    parsers: DATE_TIME_PARSERS,
  });

  dbInstance = db;
  dbReady = Promise.resolve(db);
}
