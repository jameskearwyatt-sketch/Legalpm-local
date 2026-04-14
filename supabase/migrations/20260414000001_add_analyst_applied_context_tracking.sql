-- Applied-Context Trace for all 5 analyst modules
-- Stores which learnings, precedents, and gold-standard templates were in play
-- at the moment an analysis was generated. This creates an audit trail so users
-- can see exactly what shaped any given analysis and builds trust in the
-- "learning from feedback" loop.
--
-- Also adds lightweight telemetry fields (model_used, analysis_duration_ms,
-- input_token_count, output_token_count) so we can later measure analyst
-- quality and cost over time.

DO $$
DECLARE
  t text;
  analyst_tables text[] := ARRAY[
    'ppa_analyses',
    'tolling_analyses',
    'carbon_analyses',
    'it_supply_analyses',
    'cloud_compute_analyses'
  ];
BEGIN
  FOREACH t IN ARRAY analyst_tables LOOP
    -- Applied-context arrays: which learning / precedent IDs were used
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS applied_learning_ids uuid[] NOT NULL DEFAULT ''{}''::uuid[]', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS applied_precedent_ids uuid[] NOT NULL DEFAULT ''{}''::uuid[]', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS applied_gold_standard_ids uuid[] NOT NULL DEFAULT ''{}''::uuid[]', t);

    -- Telemetry fields for future quality/cost monitoring
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS model_used text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS analysis_duration_ms integer', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS input_token_count integer', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS output_token_count integer', t);

    -- GIN indexes on the applied_* arrays so we can later query
    -- "which analyses used learning X" efficiently (e.g. for conflict detection
    -- or to show users the impact of a single correction)
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_applied_learning_ids ON %I USING GIN (applied_learning_ids)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_applied_precedent_ids ON %I USING GIN (applied_precedent_ids)', t, t);
  END LOOP;
END $$;
