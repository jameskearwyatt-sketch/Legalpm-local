import { getDb } from './pglite';
import { localStorage as localFileStorage } from './fileStorage';

// Must be a valid UUID: every user_id column in the schema is UUID-typed, so an
// invalid value would make both record creation and the data importer fail.
const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000';

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'overlaps' | 'ilike' | 'is' | 'not' | 'like';
type OrderSpec = { column: string; ascending: boolean; nullsFirst?: boolean };

interface Filter {
  op: FilterOp;
  column: string;
  value: unknown;
}

interface OrFilter {
  type: 'or';
  raw: string;
}

interface EmbeddedSelect {
  alias: string;
  table: string;
  columns: string[];
  isInner: boolean;
}

type QueryResult<T = Record<string, unknown>> = {
  data: T[] | T | null;
  error: Error | null;
  count?: number | null;
};

function parseSelectString(selectStr: string): { ownColumns: string; embedded: EmbeddedSelect[] } {
  const embedded: EmbeddedSelect[] = [];
  let ownParts: string[] = [];

  const regex = /(\w+(?::\w+)?)\s*(!inner)?\s*\(([^)]+)\)/g;
  let cleaned = selectStr;
  let match;

  while ((match = regex.exec(selectStr)) !== null) {
    const rawRef = match[1];
    const isInner = !!match[2];
    const cols = match[3].split(',').map(c => c.trim());

    let alias: string;
    let table: string;
    if (rawRef.includes(':')) {
      const [a, t] = rawRef.split(':');
      alias = a;
      table = t;
    } else {
      alias = rawRef;
      table = rawRef;
    }

    embedded.push({ alias, table, columns: cols, isInner });
    cleaned = cleaned.replace(match[0], '');
  }

  ownParts = cleaned
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return { ownColumns: ownParts.join(', ') || '*', embedded };
}

function parseOrFilter(raw: string): string {
  const parts = raw.split(',');
  const sqlParts = parts.map(part => {
    const segments = part.split('.');
    if (segments.length < 3) return 'TRUE';

    const column = segments[0];
    const op = segments[1];
    const value = segments.slice(2).join('.');

    switch (op) {
      case 'eq': return `"${column}" = '${escapeSql(value)}'`;
      case 'neq': return `"${column}" != '${escapeSql(value)}'`;
      case 'gt': return `"${column}" > '${escapeSql(value)}'`;
      case 'gte': return `"${column}" >= '${escapeSql(value)}'`;
      case 'lt': return `"${column}" < '${escapeSql(value)}'`;
      case 'lte': return `"${column}" <= '${escapeSql(value)}'`;
      case 'is':
        if (value === 'null') return `"${column}" IS NULL`;
        if (value === 'true') return `"${column}" IS TRUE`;
        if (value === 'false') return `"${column}" IS FALSE`;
        return `"${column}" IS NULL`;
      case 'ilike': return `"${column}" ILIKE '${escapeSql(value)}'`;
      case 'like': return `"${column}" LIKE '${escapeSql(value)}'`;
      case 'in': {
        const vals = value.replace(/^\(|\)$/g, '').split(',').map(v => `'${escapeSql(v.trim())}'`);
        return `"${column}" IN (${vals.join(',')})`;
      }
      default: return 'TRUE';
    }
  });
  return `(${sqlParts.join(' OR ')})`;
}

function escapeSql(val: string): string {
  return val.replace(/'/g, "''");
}

class QueryBuilder<T = Record<string, unknown>> {
  private _table: string;
  private _selectStr = '*';
  private _filters: (Filter | OrFilter)[] = [];
  private _orders: OrderSpec[] = [];
  private _limitVal: number | null = null;
  private _offsetVal: number | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _countOnly = false;
  private _countMode: 'exact' | null = null;
  private _headOnly = false;

  // mutation state
  private _mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _data: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private _onConflict: string | null = null;
  private _ignoreDuplicates = false;
  private _returning = true;

  constructor(table: string) {
    this._table = table;
  }

  select(columns?: string, opts?: { count?: 'exact'; head?: boolean }): this {
    if (columns) this._selectStr = columns;
    if (opts?.count) this._countMode = opts.count;
    if (opts?.head) this._headOnly = true;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this {
    this._mode = 'insert';
    this._data = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this._mode = 'update';
    this._data = data;
    return this;
  }

  upsert(
    data: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string; ignoreDuplicates?: boolean }
  ): this {
    this._mode = 'upsert';
    this._data = data;
    if (opts?.onConflict) this._onConflict = opts.onConflict;
    if (opts?.ignoreDuplicates) this._ignoreDuplicates = true;
    return this;
  }

  delete(): this {
    this._mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this._filters.push({ op: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this._filters.push({ op: 'neq', column, value });
    return this;
  }

  gt(column: string, value: unknown): this {
    this._filters.push({ op: 'gt', column, value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this._filters.push({ op: 'gte', column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this._filters.push({ op: 'lt', column, value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this._filters.push({ op: 'lte', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this._filters.push({ op: 'in', column, value: values });
    return this;
  }

  contains(column: string, value: unknown): this {
    this._filters.push({ op: 'contains', column, value });
    return this;
  }

  overlaps(column: string, value: unknown[]): this {
    this._filters.push({ op: 'overlaps', column, value });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this._filters.push({ op: 'ilike', column, value: pattern });
    return this;
  }

  is(column: string, value: null | boolean): this {
    this._filters.push({ op: 'is', column, value });
    return this;
  }

  not(column: string, op: string, value: unknown): this {
    if (op === 'is') {
      this._filters.push({ op: 'not', column, value: { subOp: 'is', subValue: value } });
    } else if (op === 'in') {
      this._filters.push({ op: 'not', column, value: { subOp: 'in', subValue: value } });
    }
    return this;
  }

  or(filterStr: string): this {
    this._filters.push({ type: 'or', raw: filterStr });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this._orders.push({
      column,
      ascending: opts?.ascending ?? true,
      nullsFirst: opts?.nullsFirst,
    });
    return this;
  }

  limit(count: number): this {
    this._limitVal = count;
    return this;
  }

  range(from: number, to: number): this {
    this._offsetVal = from;
    this._limitVal = to - from + 1;
    return this;
  }

  single(): this {
    this._single = true;
    this._limitVal = 1;
    return this;
  }

  maybeSingle(): this {
    this._maybeSingle = true;
    this._limitVal = 1;
    return this;
  }

  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();
      return resolve ? resolve(result) : result as unknown as TResult1;
    } catch (e) {
      if (reject) return reject(e);
      throw e;
    }
  }

  private async execute(): Promise<QueryResult<T>> {
    const db = await getDb();

    try {
      switch (this._mode) {
        case 'select': return await this.executeSelect(db);
        case 'insert': return await this.executeInsert(db);
        case 'update': return await this.executeUpdate(db);
        case 'upsert': return await this.executeUpsert(db);
        case 'delete': return await this.executeDelete(db);
      }
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  private buildWhereClause(params: unknown[], startIdx = 1): { sql: string; nextIdx: number } {
    const parts: string[] = [];
    let idx = startIdx;

    for (const f of this._filters) {
      if ('type' in f && f.type === 'or') {
        parts.push(parseOrFilter(f.raw));
        continue;
      }

      const filter = f as Filter;
      const col = `"${filter.column}"`;

      switch (filter.op) {
        case 'eq':
          parts.push(`${col} = $${idx++}`);
          params.push(filter.value);
          break;
        case 'neq':
          parts.push(`${col} != $${idx++}`);
          params.push(filter.value);
          break;
        case 'gt':
          parts.push(`${col} > $${idx++}`);
          params.push(filter.value);
          break;
        case 'gte':
          parts.push(`${col} >= $${idx++}`);
          params.push(filter.value);
          break;
        case 'lt':
          parts.push(`${col} < $${idx++}`);
          params.push(filter.value);
          break;
        case 'lte':
          parts.push(`${col} <= $${idx++}`);
          params.push(filter.value);
          break;
        case 'in':
          parts.push(`${col} = ANY($${idx++})`);
          params.push(filter.value);
          break;
        case 'contains':
          parts.push(`${col} @> $${idx++}`);
          params.push(filter.value);
          break;
        case 'overlaps':
          parts.push(`${col} && $${idx++}`);
          params.push(filter.value);
          break;
        case 'ilike':
          parts.push(`${col} ILIKE $${idx++}`);
          params.push(filter.value);
          break;
        case 'like':
          parts.push(`${col} LIKE $${idx++}`);
          params.push(filter.value);
          break;
        case 'is':
          if (filter.value === null) parts.push(`${col} IS NULL`);
          else if (filter.value === true) parts.push(`${col} IS TRUE`);
          else if (filter.value === false) parts.push(`${col} IS FALSE`);
          break;
        case 'not': {
          const v = filter.value as { subOp: string; subValue: unknown };
          if (v.subOp === 'is') {
            if (v.subValue === null) parts.push(`${col} IS NOT NULL`);
            else parts.push(`${col} IS NOT ${v.subValue}`);
          } else if (v.subOp === 'in') {
            parts.push(`NOT (${col} = ANY($${idx++}))`);
            params.push(v.subValue);
          }
          break;
        }
      }
    }

    const sql = parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '';
    return { sql, nextIdx: idx };
  }

  private buildOrderClause(): string {
    if (this._orders.length === 0) return '';
    const parts = this._orders.map(o => {
      const dir = o.ascending ? 'ASC' : 'DESC';
      const nulls = o.nullsFirst !== undefined
        ? (o.nullsFirst ? 'NULLS FIRST' : 'NULLS LAST')
        : '';
      return `"${o.column}" ${dir} ${nulls}`.trim();
    });
    return ` ORDER BY ${parts.join(', ')}`;
  }

  private buildLimitOffset(): string {
    let clause = '';
    if (this._limitVal !== null) clause += ` LIMIT ${this._limitVal}`;
    if (this._offsetVal !== null) clause += ` OFFSET ${this._offsetVal}`;
    return clause;
  }

  private async executeSelect(db: import('@electric-sql/pglite').PGlite): Promise<QueryResult<T>> {
    const { ownColumns, embedded } = parseSelectString(this._selectStr);

    if (this._headOnly && this._countMode === 'exact') {
      const params: unknown[] = [];
      const { sql: where } = this.buildWhereClause(params);
      const countSql = `SELECT COUNT(*)::int as count FROM "${this._table}"${where}`;
      const result = await db.query<{ count: number }>(countSql, params);
      return { data: null, error: null, count: result.rows[0]?.count ?? 0 };
    }

    const params: unknown[] = [];
    const { sql: where } = this.buildWhereClause(params);
    const order = this.buildOrderClause();
    const limitOffset = this.buildLimitOffset();

    const mainCols = ownColumns === '*' ? `"${this._table}".*` : ownColumns.split(',').map(c => `"${this._table}"."${c.trim()}"`).join(', ');
    let sql = `SELECT ${mainCols} FROM "${this._table}"${where}${order}${limitOffset}`;

    const mainResult = await db.query<Record<string, unknown>>(sql, params);
    let rows = mainResult.rows;

    if (embedded.length > 0 && rows.length > 0) {
      rows = await this.resolveEmbedded(db, rows, embedded);
    }

    if (this._single) {
      if (rows.length === 0) {
        return { data: null, error: new Error('No rows returned for .single()') };
      }
      return { data: rows[0] as T, error: null };
    }

    if (this._maybeSingle) {
      return { data: (rows[0] ?? null) as T, error: null };
    }

    let count: number | null = null;
    if (this._countMode === 'exact') {
      const countParams: unknown[] = [];
      const { sql: countWhere } = this.buildWhereClause(countParams);
      const countResult = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM "${this._table}"${countWhere}`, countParams
      );
      count = countResult.rows[0]?.count ?? 0;
    }

    return { data: rows as T[], error: null, count };
  }

  private async resolveEmbedded(
    db: import('@electric-sql/pglite').PGlite,
    rows: Record<string, unknown>[],
    embedded: EmbeddedSelect[]
  ): Promise<Record<string, unknown>[]> {
    for (const emb of embedded) {
      const fkCol = await this.findForeignKey(db, this._table, emb.table);
      if (!fkCol) {
        const reverseFk = await this.findForeignKey(db, emb.table, this._table);
        if (reverseFk) {
          const parentIds = rows.map(r => r.id).filter(Boolean);
          if (parentIds.length === 0) continue;

          const cols = emb.columns.join(', ');
          const childSql = `SELECT ${cols}, "${reverseFk}" as _fk_ref FROM "${emb.table}" WHERE "${reverseFk}" = ANY($1)`;
          const childResult = await db.query<Record<string, unknown>>(childSql, [parentIds]);

          const childMap = new Map<string, Record<string, unknown>[]>();
          for (const child of childResult.rows) {
            const fkVal = String(child._fk_ref);
            delete child._fk_ref;
            if (!childMap.has(fkVal)) childMap.set(fkVal, []);
            childMap.get(fkVal)!.push(child);
          }

          for (const row of rows) {
            row[emb.alias] = childMap.get(String(row.id)) ?? [];
          }
          continue;
        }

        for (const row of rows) {
          row[emb.alias] = emb.isInner ? undefined : null;
        }
        continue;
      }

      const fkValues = [...new Set(rows.map(r => r[fkCol]).filter(Boolean))];
      if (fkValues.length === 0) {
        for (const row of rows) {
          row[emb.alias] = null;
        }
        continue;
      }

      const cols = emb.columns.join(', ');
      const refSql = `SELECT id, ${cols} FROM "${emb.table}" WHERE id = ANY($1)`;
      const refResult = await db.query<Record<string, unknown>>(refSql, [fkValues]);

      const refMap = new Map<string, Record<string, unknown>>();
      for (const ref of refResult.rows) {
        refMap.set(String(ref.id), ref);
      }

      if (emb.isInner) {
        rows = rows.filter(row => {
          const val = row[fkCol];
          return val && refMap.has(String(val));
        });
      }

      for (const row of rows) {
        const fkVal = row[fkCol];
        if (fkVal && refMap.has(String(fkVal))) {
          const ref = { ...refMap.get(String(fkVal))! };
          delete ref.id;
          row[emb.alias] = ref;
        } else {
          row[emb.alias] = null;
        }
      }
    }

    return rows;
  }

  private fkCache = new Map<string, string | null>();

  private async findForeignKey(
    db: import('@electric-sql/pglite').PGlite,
    fromTable: string,
    toTable: string
  ): Promise<string | null> {
    const cacheKey = `${fromTable}->${toTable}`;
    if (this.fkCache.has(cacheKey)) return this.fkCache.get(cacheKey)!;

    const sql = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
        AND ccu.table_name = $2
      LIMIT 1
    `;
    const result = await db.query<{ column_name: string }>(sql, [fromTable, toTable]);
    const col = result.rows[0]?.column_name ?? null;
    this.fkCache.set(cacheKey, col);
    return col;
  }

  private async executeInsert(db: import('@electric-sql/pglite').PGlite): Promise<QueryResult<T>> {
    const dataArr = Array.isArray(this._data) ? this._data : [this._data!];
    if (dataArr.length === 0) return { data: [], error: null };

    const enriched = dataArr.map(row => ({
      ...row,
      user_id: row.user_id ?? LOCAL_USER_ID,
    }));

    const columns = Object.keys(enriched[0]);
    const params: unknown[] = [];
    const valueSets: string[] = [];

    for (const row of enriched) {
      const placeholders: string[] = [];
      for (const col of columns) {
        params.push(serializeValue(row[col]));
        placeholders.push(`$${params.length}`);
      }
      valueSets.push(`(${placeholders.join(', ')})`);
    }

    const colList = columns.map(c => `"${c}"`).join(', ');
    const returning = this._returning ? ' RETURNING *' : '';
    const sql = `INSERT INTO "${this._table}" (${colList}) VALUES ${valueSets.join(', ')}${returning}`;

    const result = await db.query<Record<string, unknown>>(sql, params);

    if (this._single || this._maybeSingle) {
      return { data: (result.rows[0] ?? null) as T, error: null };
    }
    return { data: result.rows as T[], error: null };
  }

  private async executeUpdate(db: import('@electric-sql/pglite').PGlite): Promise<QueryResult<T>> {
    const data = this._data as Record<string, unknown>;
    const columns = Object.keys(data);
    const params: unknown[] = [];

    const setClauses = columns.map(col => {
      params.push(serializeValue(data[col]));
      return `"${col}" = $${params.length}`;
    });

    const { sql: where } = this.buildWhereClause(params, params.length + 1);
    const returning = this._returning ? ' RETURNING *' : '';
    const sql = `UPDATE "${this._table}" SET ${setClauses.join(', ')}${where}${returning}`;

    const result = await db.query<Record<string, unknown>>(sql, params);

    if (this._single || this._maybeSingle) {
      return { data: (result.rows[0] ?? null) as T, error: null };
    }
    return { data: result.rows as T[], error: null };
  }

  private async executeUpsert(db: import('@electric-sql/pglite').PGlite): Promise<QueryResult<T>> {
    const dataArr = Array.isArray(this._data) ? this._data : [this._data!];
    if (dataArr.length === 0) return { data: [], error: null };

    const enriched = dataArr.map(row => ({
      ...row,
      user_id: row.user_id ?? LOCAL_USER_ID,
    }));

    const columns = Object.keys(enriched[0]);
    const params: unknown[] = [];
    const valueSets: string[] = [];

    for (const row of enriched) {
      const placeholders: string[] = [];
      for (const col of columns) {
        params.push(serializeValue(row[col]));
        placeholders.push(`$${params.length}`);
      }
      valueSets.push(`(${placeholders.join(', ')})`);
    }

    const colList = columns.map(c => `"${c}"`).join(', ');
    const conflictCols = this._onConflict || 'id';

    let onConflict: string;
    if (this._ignoreDuplicates) {
      onConflict = `ON CONFLICT (${conflictCols}) DO NOTHING`;
    } else {
      const updateCols = columns
        .filter(c => !conflictCols.split(',').map(cc => cc.trim()).includes(c))
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
      onConflict = updateCols
        ? `ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateCols}`
        : `ON CONFLICT (${conflictCols}) DO NOTHING`;
    }

    const returning = this._returning ? ' RETURNING *' : '';
    const sql = `INSERT INTO "${this._table}" (${colList}) VALUES ${valueSets.join(', ')} ${onConflict}${returning}`;

    const result = await db.query<Record<string, unknown>>(sql, params);

    if (this._single || this._maybeSingle) {
      return { data: (result.rows[0] ?? null) as T, error: null };
    }
    return { data: result.rows as T[], error: null };
  }

  private async executeDelete(db: import('@electric-sql/pglite').PGlite): Promise<QueryResult<T>> {
    const params: unknown[] = [];
    const { sql: where } = this.buildWhereClause(params);
    const returning = this._returning ? ' RETURNING *' : '';
    const sql = `DELETE FROM "${this._table}"${where}${returning}`;

    const result = await db.query<Record<string, unknown>>(sql, params);

    if (this._single || this._maybeSingle) {
      return { data: (result.rows[0] ?? null) as T, error: null };
    }
    return { data: result.rows as T[], error: null };
  }
}

function serializeValue(val: unknown): unknown {
  if (val === undefined) return null;
  if (val === null) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return JSON.stringify(val);
  return val;
}

const localAuth = {
  getSession: async () => ({
    data: {
      session: {
        user: {
          id: LOCAL_USER_ID,
          email: 'local@legalpm.app',
          user_metadata: { full_name: 'Local User' },
        },
        access_token: 'local-token',
      },
    },
    error: null,
  }),
  getUser: async () => ({
    data: {
      user: {
        id: LOCAL_USER_ID,
        email: 'local@legalpm.app',
        user_metadata: { full_name: 'Local User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    },
    error: null,
  }),
  onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
    setTimeout(() => {
      callback('SIGNED_IN', {
        user: {
          id: LOCAL_USER_ID,
          email: 'local@legalpm.app',
          user_metadata: { full_name: 'Local User' },
        },
        access_token: 'local-token',
      });
    }, 0);
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
  signInWithPassword: async () => ({
    data: {
      user: {
        id: LOCAL_USER_ID,
        email: 'local@legalpm.app',
        user_metadata: { full_name: 'Local User' },
      },
      session: { access_token: 'local-token' },
    },
    error: null,
  }),
  signUp: async () => ({
    data: {
      user: {
        id: LOCAL_USER_ID,
        email: 'local@legalpm.app',
        user_metadata: { full_name: 'Local User' },
      },
      session: { access_token: 'local-token' },
    },
    error: null,
  }),
  signOut: async () => ({ error: null }),
  verifyOtp: async () => ({
    data: { user: null, session: null },
    error: new Error('OTP not supported in local mode'),
  }),
};

const localFunctions = {
  invoke: async (name: string, options?: { body?: unknown }) => {
    console.warn(`[LegalPM Local] Edge function "${name}" called — AI features require API key configuration.`);
    return {
      data: null,
      error: new Error(`Edge function "${name}" is not available in local mode. Configure an AI provider in Settings to enable AI features.`),
    };
  },
};

export const db = {
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },
  auth: localAuth,
  functions: localFunctions,
  storage: localFileStorage,
  rpc: async (name: string, params?: Record<string, unknown>) => {
    const pgDb = await getDb();
    const paramNames = params ? Object.keys(params) : [];
    const paramValues = params ? Object.values(params) : [];
    const placeholders = paramNames.map((n, i) => `"${n}" := $${i + 1}`).join(', ');
    const sql = `SELECT * FROM "${name}"(${placeholders})`;
    try {
      const result = await pgDb.query(sql, paramValues);
      return { data: result.rows, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },
};

export { LOCAL_USER_ID };
export type { QueryResult };
