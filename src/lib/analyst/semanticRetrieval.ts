/**
 * Semantic retrieval helpers for analyst tools.
 *
 * These talk to the `embed-text` edge function (OpenAI text-embedding-3-small)
 * and to the `match_*` Postgres RPC functions added in
 * 20260415000001_add_embedding_vector_retrieval.sql.
 *
 * All retrieval functions are designed to fail soft: if embedding generation
 * is unavailable (e.g. no OPENAI_API_KEY configured) they return `null`,
 * and callers should fall back to the pre-embedding "all active" behaviour.
 */
import { supabase } from '@/integrations/supabase/client';

export type AnalystType = 'ppa' | 'tolling' | 'carbon' | 'it_supply' | 'cloud_compute';

const LEARNINGS_RPC: Record<AnalystType, string> = {
  ppa: 'match_ppa_learnings',
  tolling: 'match_tolling_learnings',
  carbon: 'match_carbon_learnings',
  it_supply: 'match_it_supply_learnings',
  cloud_compute: 'match_cloud_compute_learnings',
};

const PRECEDENTS_RPC: Record<AnalystType, string> = {
  ppa: 'match_ppa_precedents',
  tolling: 'match_tolling_precedents',
  carbon: 'match_carbon_precedents',
  it_supply: 'match_it_supply_precedents',
  cloud_compute: 'match_cloud_compute_precedents',
};

const SIMILAR_LEARNINGS_RPC: Record<AnalystType, string> = {
  ppa: 'find_similar_ppa_learnings',
  tolling: 'find_similar_tolling_learnings',
  carbon: 'find_similar_carbon_learnings',
  it_supply: 'find_similar_it_supply_learnings',
  cloud_compute: 'find_similar_cloud_compute_learnings',
};

const LEARNING_TABLES: Record<AnalystType, string> = {
  ppa: 'ppa_ai_learnings',
  tolling: 'tolling_learnings',
  carbon: 'carbon_learnings',
  it_supply: 'it_supply_learnings',
  cloud_compute: 'cloud_compute_learnings',
};

const PRECEDENT_TABLES: Record<AnalystType, string> = {
  ppa: 'ppa_precedent_bank',
  tolling: 'tolling_precedent_bank',
  carbon: 'carbon_precedent_bank',
  it_supply: 'it_supply_precedent_bank',
  cloud_compute: 'cloud_compute_precedent_bank',
};

/**
 * Generate a 1536-dim embedding for a text snippet, or null if the backend
 * is not configured / fails. Never throws — callers treat null as
 * "semantic retrieval unavailable, use fallback".
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      },
    );
    if (!res.ok) {
      // 501 => OPENAI_API_KEY not configured → graceful fallback
      console.warn(`embed-text returned ${res.status}, falling back to non-semantic retrieval`);
      return null;
    }
    const json = await res.json();
    if (json?.disabled || json?.reason === 'not_configured') {
      return null;
    }
    return Array.isArray(json.embedding) ? json.embedding : null;
  } catch (err) {
    console.warn('embed-text failed, falling back:', err);
    return null;
  }
}

/**
 * Batch embed up to N texts in one round trip.
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ texts }),
      },
    );
    if (!res.ok) return texts.map(() => null);
    const json = await res.json();
    if (json?.disabled || json?.reason === 'not_configured') {
      return texts.map(() => null);
    }
    return Array.isArray(json.embeddings)
      ? (json.embeddings as (number[] | null)[])
      : texts.map(() => null);
  } catch {
    return texts.map(() => null);
  }
}

/**
 * Ask the DB for the top-K most relevant learnings to a query embedding.
 * Returns `null` if embedding was null (caller should fall back).
 */
export async function matchLearnings<T = unknown>(
  analyst: AnalystType,
  queryEmbedding: number[] | null,
  matchCount: number = 10,
  matchThreshold: number = 0.3,
): Promise<T[] | null> {
  if (!queryEmbedding) return null;
  const { data, error } = await supabase.rpc(LEARNINGS_RPC[analyst] as never, {
    query_embedding: queryEmbedding as never,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.warn(`${LEARNINGS_RPC[analyst]} RPC failed:`, error);
    return null;
  }
  return (data || []) as T[];
}

export async function matchPrecedents<T = unknown>(
  analyst: AnalystType,
  queryEmbedding: number[] | null,
  matchCount: number = 10,
  matchThreshold: number = 0.3,
  onlyGoldStandard: boolean = false,
): Promise<T[] | null> {
  if (!queryEmbedding) return null;
  const { data, error } = await supabase.rpc(PRECEDENTS_RPC[analyst] as never, {
    query_embedding: queryEmbedding as never,
    match_count: matchCount,
    match_threshold: matchThreshold,
    only_gold_standard: onlyGoldStandard,
  });
  if (error) {
    console.warn(`${PRECEDENTS_RPC[analyst]} RPC failed:`, error);
    return null;
  }
  return (data || []) as T[];
}

/**
 * Shape returned by the `find_similar_*_learnings` RPC family.
 * Different analysts have slightly different learning columns (PPA has
 * `user_feedback`; the other 4 have `correction_reason`), but the shared
 * columns below are always present.
 */
export interface SimilarLearning {
  id: string;
  category: string;
  original_position: string | null;
  corrected_position: string | null;
  user_feedback?: string | null;
  correction_reason?: string | null;
  is_active: boolean;
  created_at: string;
  similarity: number;
}

/**
 * Given a category + free text, returns existing learnings in the same
 * category that are semantically similar above `matchThreshold` (cosine
 * similarity). Intended for conflict detection in the "add correction"
 * dialog — if the new correction overlaps an existing one, the user should
 * be asked to merge/override instead of silently layering.
 *
 * Returns `null` when the embedding backend is unavailable (caller should
 * skip the warning UI). Returns `[]` if no conflicts.
 */
export async function findSimilarLearnings(
  analyst: AnalystType,
  category: string,
  text: string,
  matchCount: number = 5,
  matchThreshold: number = 0.55,
): Promise<SimilarLearning[] | null> {
  if (!category || !text || !text.trim()) return [];
  const embedding = await embedText(text);
  if (!embedding) return null;
  const { data, error } = await supabase.rpc(SIMILAR_LEARNINGS_RPC[analyst] as never, {
    query_embedding: embedding as never,
    filter_category: category,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) {
    console.warn(`${SIMILAR_LEARNINGS_RPC[analyst]} RPC failed:`, error);
    return null;
  }
  return (data || []) as SimilarLearning[];
}

/**
 * Fire-and-forget: embed some text and write it back to a specific row.
 * Caller passes the analyst type, whether this is a learning or a precedent,
 * the row id, and the text to embed. Errors are swallowed so mutation flows
 * are not blocked by embedding failures.
 */
export async function embedAndStore(
  analyst: AnalystType,
  kind: 'learning' | 'precedent',
  rowId: string,
  text: string,
): Promise<void> {
  try {
    const embedding = await embedText(text);
    if (!embedding) return;
    const table = kind === 'learning' ? LEARNING_TABLES[analyst] : PRECEDENT_TABLES[analyst];
    const { error } = await supabase
      .from(table as never)
      .update({
        embedding: embedding as never,
        embedding_model: 'text-embedding-3-small',
        embedded_at: new Date().toISOString(),
      } as never)
      .eq('id', rowId);
    if (error) console.warn(`embedding write to ${table} failed:`, error);
  } catch (err) {
    console.warn('embedAndStore failed:', err);
  }
}
