import type { PGlite } from '@electric-sql/pglite';
import schemaSql from './schema.sql?raw';

export const SCHEMA_VERSION = 1;

export async function runMigrations(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const result = await db.query<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1'
  );
  const currentVersion = result.rows[0]?.version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  if (currentVersion === 0) {
    await db.exec(schemaSql);
  }

  await db.query(
    'INSERT INTO schema_version (version) VALUES ($1)',
    [SCHEMA_VERSION]
  );
}
