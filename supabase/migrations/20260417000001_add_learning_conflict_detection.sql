-- Learning-quality controls (Upgrade #5 — phase 1: conflict detection)
--
-- Before a user saves a new "correction" / learning, we want to surface any
-- existing active learnings in the same tool+category that look semantically
-- similar, so the user can merge, supersede, or override instead of layering
-- conflicting instructions.
--
-- This migration adds 5 `find_similar_*_learnings` RPC functions (one per
-- analyst tool) that filter by category AND by embedding similarity.
-- They are intentionally separate from the existing `match_*_learnings`
-- functions because:
--   * callers here pass a `filter_category` required param,
--   * they return a stricter shape focused on human review (no project fields
--     irrelevant to conflict resolution),
--   * they default to a higher similarity floor (0.55) because we only want
--     "likely same topic" hits, not the broad recall used for prompt context.
--
-- All functions respect RLS via SECURITY INVOKER (user only sees their own
-- rows via the underlying table policies).

-- --------------------------------------------------------------------------
-- PPA
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_ppa_learnings(
  query_embedding vector(1536),
  filter_category text,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  category text,
  original_position text,
  corrected_position text,
  user_feedback text,
  is_active boolean,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position,
         l.user_feedback, l.is_active, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM ppa_ai_learnings l
  WHERE l.category = filter_category
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- Tolling
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_tolling_learnings(
  query_embedding vector(1536),
  filter_category text,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, is_active boolean, created_at timestamptz,
  similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position,
         l.correction_reason, l.is_active, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM tolling_learnings l
  WHERE l.category = filter_category
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- Carbon
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_carbon_learnings(
  query_embedding vector(1536),
  filter_category text,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, is_active boolean, created_at timestamptz,
  similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position,
         l.correction_reason, l.is_active, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM carbon_learnings l
  WHERE l.category = filter_category
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- IT Supply
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_it_supply_learnings(
  query_embedding vector(1536),
  filter_category text,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, is_active boolean, created_at timestamptz,
  similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position,
         l.correction_reason, l.is_active, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM it_supply_learnings l
  WHERE l.category = filter_category
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- Cloud Compute
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_similar_cloud_compute_learnings(
  query_embedding vector(1536),
  filter_category text,
  match_threshold float DEFAULT 0.55,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, is_active boolean, created_at timestamptz,
  similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position,
         l.correction_reason, l.is_active, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM cloud_compute_learnings l
  WHERE l.category = filter_category
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION find_similar_ppa_learnings          TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_tolling_learnings      TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_carbon_learnings       TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_it_supply_learnings    TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_cloud_compute_learnings TO authenticated;
