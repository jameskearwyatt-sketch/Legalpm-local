/**
 * Backfill embeddings for pre-existing learnings and precedent-bank rows.
 *
 * When pgvector was introduced (20260415000001) all existing rows had
 * `embedding IS NULL` and were excluded from `match_*` RPCs. Going forward,
 * every new correction or bank-commit gets embedded via `embedAndStore`, but
 * the backlog has to be processed by an admin tool like this one.
 *
 * The strategy:
 *   - Count NULL-embedding rows per table so the admin knows the scope.
 *   - Stream in batches of 10 ids, fetch the row text, embed in batch via
 *     `embedTexts`, then write each embedding back one-by-one (pgvector
 *     doesn't support bulk UPDATE ... FROM VALUES ergonomically via the JS
 *     client, and the failure mode of per-row UPDATE is better — one flaky
 *     row doesn't poison the batch).
 *   - Short-circuit cleanly if the embed-text function returns 501 (no
 *     OPENAI_API_KEY configured on the edge function).
 *
 * RLS: the admin page is wrapped in AdminRoute, but the actual SELECT/UPDATE
 * still go through supabase-js → RLS policies. Admins can read all users'
 * learnings/precedents (see has_role('admin') policies added in audit
 * migrations), which is necessary for a global backfill.
 */
import { supabase } from '@/integrations/supabase/client';
import { embedTexts } from './semanticRetrieval';
import type { AnalystType } from './semanticRetrieval';

export type BackfillKind = 'learning' | 'precedent';

export interface BackfillTarget {
  analyst: AnalystType;
  kind: BackfillKind;
  table: string;
  label: string;
}

export const BACKFILL_TARGETS: BackfillTarget[] = [
  { analyst: 'ppa',           kind: 'learning',  table: 'ppa_ai_learnings',           label: 'PPA Learnings' },
  { analyst: 'tolling',       kind: 'learning',  table: 'tolling_learnings',          label: 'Tolling Learnings' },
  { analyst: 'carbon',        kind: 'learning',  table: 'carbon_learnings',           label: 'Carbon Learnings' },
  { analyst: 'it_supply',     kind: 'learning',  table: 'it_supply_learnings',        label: 'IT Supply Learnings' },
  { analyst: 'cloud_compute', kind: 'learning',  table: 'cloud_compute_learnings',    label: 'Cloud Compute Learnings' },
  { analyst: 'ppa',           kind: 'precedent', table: 'ppa_precedent_bank',         label: 'PPA Precedent Bank' },
  { analyst: 'tolling',       kind: 'precedent', table: 'tolling_precedent_bank',     label: 'Tolling Precedent Bank' },
  { analyst: 'carbon',        kind: 'precedent', table: 'carbon_precedent_bank',      label: 'Carbon Precedent Bank' },
  { analyst: 'it_supply',     kind: 'precedent', table: 'it_supply_precedent_bank',   label: 'IT Supply Precedent Bank' },
  { analyst: 'cloud_compute', kind: 'precedent', table: 'cloud_compute_precedent_bank', label: 'Cloud Compute Precedent Bank' },
];

const BATCH_SIZE = 10;

/** Count rows needing backfill across all ten tables. */
export async function countMissingEmbeddings(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of BACKFILL_TARGETS) {
    const { count, error } = await supabase
      .from(t.table as never)
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    out[t.table] = error ? 0 : count ?? 0;
  }
  return out;
}

interface RowText { id: string; text: string }

/**
 * Build the text to embed for a single row. Keep this in sync with the
 * text-composition callers in upload components + embedAndStore so retrieval
 * stays coherent across new-row and backfill paths.
 */
function composeText(kind: BackfillKind, row: Record<string, unknown>): string {
  if (kind === 'learning') {
    const category = String(row.category || '');
    const original = String(row.original_position || '');
    const corrected = String(row.corrected_position || '');
    const feedback = String(row.user_feedback || row.correction_reason || '');
    return [category, original, corrected, feedback].filter(Boolean).join(' — ').trim();
  }
  // precedent
  const category = String(row.category || '');
  const summary = String(row.position_summary || '');
  const project = String(row.project_name || '');
  return [category, project, summary].filter(Boolean).join(' — ').trim();
}

/**
 * Load up to `batchSize` rows needing embedding from a single table.
 * Returns just the id + composed text so the caller can batch-embed.
 */
async function loadBatch(target: BackfillTarget, batchSize: number): Promise<RowText[] | null> {
  const columns = target.kind === 'learning'
    ? 'id, category, original_position, corrected_position, user_feedback, correction_reason'
    : 'id, category, project_name, position_summary';
  const { data, error } = await supabase
    .from(target.table as never)
    .select(columns)
    .is('embedding', null)
    .limit(batchSize);
  if (error) {
    console.warn(`loadBatch(${target.table}) failed:`, error);
    return null;
  }
  const rows = (data as unknown as Record<string, unknown>[] | null) || [];
  return rows.map(r => ({
    id: String(r.id),
    text: composeText(target.kind, r),
  })).filter(r => r.text.length > 0);
}

export interface BackfillProgress {
  table: string;
  label: string;
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface BackfillResult {
  table: string;
  label: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  aborted?: boolean;
  abortReason?: string;
}

/**
 * Backfill embeddings for a single table. Streams in batches of 10,
 * reports progress via the callback, and stops early if the embed-text
 * backend is unavailable (so the admin sees a clear "configure
 * OPENAI_API_KEY" message instead of a long run of zero-writes).
 */
export async function backfillOne(
  target: BackfillTarget,
  onProgress: (p: BackfillProgress) => void,
  shouldAbort: () => boolean,
): Promise<BackfillResult> {
  const startCount = (await countMissingEmbeddings())[target.table] ?? 0;
  const total = startCount;
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  while (true) {
    if (shouldAbort()) {
      return { table: target.table, label: target.label, total, succeeded, failed, skipped, aborted: true, abortReason: 'user cancelled' };
    }
    const batch = await loadBatch(target, BATCH_SIZE);
    if (batch === null) {
      return { table: target.table, label: target.label, total, succeeded, failed, skipped, aborted: true, abortReason: 'select failed' };
    }
    if (batch.length === 0) break;

    const embeddings = await embedTexts(batch.map(r => r.text));
    const allNull = embeddings.every(e => !e);
    if (allNull && batch.length > 0) {
      // embed backend likely not configured — abort early rather than hammer
      return {
        table: target.table,
        label: target.label,
        total,
        succeeded,
        failed,
        skipped,
        aborted: true,
        abortReason: 'embed-text unavailable (check OPENAI_API_KEY)',
      };
    }

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const emb = embeddings[i];
      processed += 1;
      if (!emb) {
        skipped += 1;
        continue;
      }
      const { error } = await supabase
        .from(target.table as never)
        .update({
          embedding: emb as never,
          embedding_model: 'text-embedding-3-small',
          embedded_at: new Date().toISOString(),
        } as never)
        .eq('id', row.id);
      if (error) {
        console.warn(`update ${target.table} id=${row.id} failed:`, error);
        failed += 1;
      } else {
        succeeded += 1;
      }
    }

    onProgress({
      table: target.table,
      label: target.label,
      processed,
      total,
      succeeded,
      failed,
      skipped,
    });
  }

  return { table: target.table, label: target.label, total, succeeded, failed, skipped };
}
