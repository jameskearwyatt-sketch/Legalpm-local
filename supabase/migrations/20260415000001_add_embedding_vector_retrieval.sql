-- Embedding-based semantic retrieval for all 5 analyst tools
-- Adds a pgvector column to each learnings and precedent-bank table so we can
-- retrieve only the top-K most relevant items for each new analysis instead
-- of dumping every active learning / precedent into the LLM prompt.
--
-- Why 1536 dims: matches OpenAI text-embedding-3-small, the default model.
-- If the user later switches models with different dims, the column can be
-- altered and rows re-embedded.

CREATE EXTENSION IF NOT EXISTS vector;

-- --------------------------------------------------------------------------
-- 1. Add embedding columns to all learnings + precedent-bank tables
-- --------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  targets text[] := ARRAY[
    'ppa_ai_learnings',
    'tolling_learnings',
    'carbon_learnings',
    'it_supply_learnings',
    'cloud_compute_learnings',
    'ppa_precedent_bank',
    'tolling_precedent_bank',
    'carbon_precedent_bank',
    'it_supply_precedent_bank',
    'cloud_compute_precedent_bank'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS embedding vector(1536)', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS embedding_model text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS embedded_at timestamptz', t);
    -- IVFFlat index: fine up to ~1M rows, needs ANALYZE to populate cluster centres.
    -- lists=100 is a reasonable default; can be re-tuned once we have data.
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_embedding ON %I USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)',
      t, t
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 2. Similarity-search RPC functions: one pair per analyst
-- Each returns the top-K rows above a similarity threshold for a given
-- query embedding, scoped by auth.uid() via RLS on the underlying table.
-- --------------------------------------------------------------------------

-- PPA learnings
CREATE OR REPLACE FUNCTION match_ppa_learnings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category text,
  original_position text,
  corrected_position text,
  user_feedback text,
  project_context text,
  jurisdiction text,
  ppa_type text,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position, l.user_feedback,
         l.project_context, l.jurisdiction, l.ppa_type, l.created_at,
         1 - (l.embedding <=> query_embedding) AS similarity
  FROM ppa_ai_learnings l
  WHERE l.is_active = true
    AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Generic macro for the other 4 analysts' learnings — same shape, different tables
CREATE OR REPLACE FUNCTION match_tolling_learnings(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, created_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position, l.correction_reason,
         l.created_at, 1 - (l.embedding <=> query_embedding) AS similarity
  FROM tolling_learnings l
  WHERE l.is_active = true AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_carbon_learnings(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, created_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position, l.correction_reason,
         l.created_at, 1 - (l.embedding <=> query_embedding) AS similarity
  FROM carbon_learnings l
  WHERE l.is_active = true AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_it_supply_learnings(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, created_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position, l.correction_reason,
         l.created_at, 1 - (l.embedding <=> query_embedding) AS similarity
  FROM it_supply_learnings l
  WHERE l.is_active = true AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_cloud_compute_learnings(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10
) RETURNS TABLE (
  id uuid, category text, original_position text, corrected_position text,
  correction_reason text, created_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT l.id, l.category, l.original_position, l.corrected_position, l.correction_reason,
         l.created_at, 1 - (l.embedding <=> query_embedding) AS similarity
  FROM cloud_compute_learnings l
  WHERE l.is_active = true AND l.embedding IS NOT NULL
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding LIMIT match_count;
$$;

-- --------------------------------------------------------------------------
-- 3. Precedent-bank match functions (one per analyst)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION match_ppa_precedents(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10,
  only_gold_standard boolean DEFAULT false
) RETURNS TABLE (
  id uuid, category text, position_summary text, project_name text,
  jurisdiction text, is_gold_standard boolean, template_name text,
  banked_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT p.id, p.category, p.position_summary, p.project_name, p.jurisdiction,
         p.is_gold_standard, p.template_name, p.banked_at,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM ppa_precedent_bank p
  WHERE p.embedding IS NOT NULL
    AND (NOT only_gold_standard OR p.is_gold_standard = true)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_tolling_precedents(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10,
  only_gold_standard boolean DEFAULT false
) RETURNS TABLE (
  id uuid, category text, position_summary text, project_name text,
  jurisdiction text, is_gold_standard boolean, template_name text,
  banked_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT p.id, p.category, p.position_summary, p.project_name, p.jurisdiction,
         p.is_gold_standard, p.template_name, p.banked_at,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM tolling_precedent_bank p
  WHERE p.embedding IS NOT NULL
    AND (NOT only_gold_standard OR p.is_gold_standard = true)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_carbon_precedents(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10,
  only_gold_standard boolean DEFAULT false
) RETURNS TABLE (
  id uuid, category text, position_summary text, project_name text,
  jurisdiction text, is_gold_standard boolean, template_name text,
  banked_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT p.id, p.category, p.position_summary, p.project_name, p.jurisdiction,
         p.is_gold_standard, p.template_name, p.banked_at,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM carbon_precedent_bank p
  WHERE p.embedding IS NOT NULL
    AND (NOT only_gold_standard OR p.is_gold_standard = true)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_it_supply_precedents(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10,
  only_gold_standard boolean DEFAULT false
) RETURNS TABLE (
  id uuid, category text, position_summary text, project_name text,
  jurisdiction text, is_gold_standard boolean, template_name text,
  banked_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT p.id, p.category, p.position_summary, p.project_name, p.jurisdiction,
         p.is_gold_standard, p.template_name, p.banked_at,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM it_supply_precedent_bank p
  WHERE p.embedding IS NOT NULL
    AND (NOT only_gold_standard OR p.is_gold_standard = true)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_cloud_compute_precedents(
  query_embedding vector(1536), match_threshold float DEFAULT 0.3, match_count int DEFAULT 10,
  only_gold_standard boolean DEFAULT false
) RETURNS TABLE (
  id uuid, category text, position_summary text, project_name text,
  jurisdiction text, is_gold_standard boolean, template_name text,
  banked_at timestamptz, similarity float
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT p.id, p.category, p.position_summary, p.project_name, p.jurisdiction,
         p.is_gold_standard, p.template_name, p.banked_at,
         1 - (p.embedding <=> query_embedding) AS similarity
  FROM cloud_compute_precedent_bank p
  WHERE p.embedding IS NOT NULL
    AND (NOT only_gold_standard OR p.is_gold_standard = true)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
$$;
