import { getDb } from './pglite';
import { LOCAL_USER_ID } from './client';
import { SCHEMA_VERSION } from './schema';

/**
 * Imports a JSON data export produced by the original Supabase-backed cloud app
 * into the local PGlite database.
 *
 * The export shape is:
 *   {
 *     format: "legalpm-data-export",
 *     schema_version: number,
 *     exported_at?: string,
 *     user_id?: string,                     // the cloud user's id, remapped to LOCAL_USER_ID
 *     tables: { [tableName: string]: Row[] }
 *   }
 *
 * Strategy: all inserts run inside a single transaction with
 * `session_replication_role = 'replica'`, which disables foreign-key checks and
 * triggers. That means insert order is irrelevant (circular FKs are fine) and
 * original timestamps / generated values are preserved. Inserts are idempotent
 * (`ON CONFLICT DO NOTHING`) and chunked to keep parameter counts reasonable.
 */

const CHUNK_SIZE = 200;

export interface ImportResult {
  /** Total rows actually inserted across all tables. */
  inserted: number;
  /** Number of tables in the export that contained at least one row. */
  tablesWithData: number;
  /** Rows inserted per table. */
  perTable: Record<string, number>;
  /** Non-fatal issues encountered (skipped tables, dropped columns, etc.). */
  warnings: string[];
}

interface ColumnInfo {
  dataType: string; // information_schema.columns.data_type, e.g. 'jsonb', 'json', 'ARRAY', 'text'
}

interface DataExport {
  format?: string;
  schema_version?: number;
  user_id?: string;
  tables?: Record<string, Array<Record<string, unknown>>>;
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

export async function importDataExport(file: File): Promise<ImportResult> {
  const text = await file.text();

  let parsed: DataExport;
  try {
    parsed = JSON.parse(text) as DataExport;
  } catch {
    throw new Error('File is not valid JSON.');
  }

  if (parsed.format !== 'legalpm-data-export') {
    throw new Error(
      `Unrecognized file format${parsed.format ? ` ("${parsed.format}")` : ''}. Expected a "legalpm-data-export" file.`
    );
  }

  const exportVersion = parsed.schema_version ?? 0;
  if (exportVersion > SCHEMA_VERSION) {
    throw new Error(
      `Export schema version (${exportVersion}) is newer than this app supports (${SCHEMA_VERSION}). Update the app before importing.`
    );
  }

  const tables = parsed.tables ?? {};
  const cloudUserId = typeof parsed.user_id === 'string' ? parsed.user_id : undefined;

  const warnings: string[] = [];
  const perTable: Record<string, number> = {};
  let inserted = 0;
  let tablesWithData = 0;

  if (!cloudUserId) {
    warnings.push('Export has no top-level user_id; rows were imported without remapping ownership.');
  }

  const db = await getDb();

  // Remaps the cloud user's id (anywhere it appears as a column value) to the local user id.
  const remap = (value: unknown): unknown =>
    cloudUserId && typeof value === 'string' && value === cloudUserId ? LOCAL_USER_ID : value;

  // Look up the real column set + data types for a table from the live schema.
  const loadColumns = async (table: string): Promise<Map<string, ColumnInfo> | null> => {
    const res = await db.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (res.rows.length === 0) return null;
    const map = new Map<string, ColumnInfo>();
    for (const row of res.rows) {
      map.set(row.column_name, { dataType: row.data_type });
    }
    return map;
  };

  // Serialize a value for a parameterized insert based on its column type.
  const serialize = (value: unknown, info: ColumnInfo): unknown => {
    const v = remap(value);
    if (v === undefined || v === null) return null;
    if (info.dataType === 'jsonb' || info.dataType === 'json') {
      return JSON.stringify(v);
    }
    // ARRAY columns: pass the JS array straight through (node-postgres-style binding).
    return v;
  };

  // Build per-table plans before opening the transaction (schema lookups are read-only).
  interface TablePlan {
    table: string;
    rows: Array<Record<string, unknown>>;
    columns: string[];
    columnInfo: Map<string, ColumnInfo>;
  }

  const plans: TablePlan[] = [];

  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    tablesWithData++;

    const columnInfo = await loadColumns(table);
    if (!columnInfo) {
      warnings.push(`Table "${table}" does not exist locally — skipped ${rows.length} row(s).`);
      continue;
    }

    // Columns present in the export data (union across all rows).
    const present = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) present.add(key);
    }

    const known = [...present].filter((c) => columnInfo.has(c));
    const unknown = [...present].filter((c) => !columnInfo.has(c));
    if (unknown.length > 0) {
      warnings.push(`Table "${table}": dropped unknown column(s): ${unknown.join(', ')}.`);
    }
    if (known.length === 0) {
      warnings.push(`Table "${table}": no recognized columns — skipped ${rows.length} row(s).`);
      continue;
    }

    plans.push({ table, rows, columns: known, columnInfo });
    perTable[table] = 0;
  }

  // Each table is imported in its own transaction. Disabling FK checks + triggers
  // (session_replication_role = 'replica') means insert order and circular FKs
  // never fail and original timestamps/values are kept verbatim. Isolating each
  // table means one problematic table (e.g. an auth table that is irrelevant in
  // local mode) is skipped with a warning rather than aborting the whole import.
  for (const plan of plans) {
    const { table, rows, columns, columnInfo } = plan;
    const colSql = columns.map(quoteIdent).join(', ');

    try {
      const tableInserted = await db.transaction(async (tx) => {
        await tx.exec(`SET LOCAL session_replication_role = 'replica'`);

        let count = 0;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const params: unknown[] = [];
          const tuples: string[] = [];

          for (const row of chunk) {
            const placeholders = columns.map((col) => {
              params.push(serialize(row[col], columnInfo.get(col)!));
              return `$${params.length}`;
            });
            tuples.push(`(${placeholders.join(', ')})`);
          }

          const sql =
            `INSERT INTO ${quoteIdent(table)} (${colSql}) VALUES ${tuples.join(', ')} ` +
            `ON CONFLICT DO NOTHING`;

          const res = await tx.query(sql, params);
          count += res.affectedRows ?? 0;
        }
        return count;
      });

      perTable[table] = tableInserted;
      inserted += tableInserted;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      warnings.push(`Table "${table}": import failed and was skipped — ${message}`);
      delete perTable[table];
    }
  }

  return { inserted, tablesWithData, perTable, warnings };
}
