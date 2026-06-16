import type { PGlite } from '@electric-sql/pglite';
import schemaSql from './schema.sql?raw';

export const SCHEMA_VERSION = 2;

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
    // Fresh database — apply the full schema (already free of enrichment columns).
    await db.exec(schemaSql);
  } else {
    // Incremental migrations for existing local databases.
    if (currentVersion < 2) {
      // v2: drop the leftover contact-enrichment column/index.
      await db.exec(`
        DROP INDEX IF EXISTS idx_distribution_contacts_last_enriched;
        ALTER TABLE public.distribution_contacts DROP COLUMN IF EXISTS last_enriched_at;
      `);
    }
  }

  await db.query(
    'INSERT INTO schema_version (version) VALUES ($1)',
    [SCHEMA_VERSION]
  );
}
