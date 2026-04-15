-- Analyst regression harness (Upgrade #5 phase 2) —
-- golden-set regression testing for analyst outputs.
--
-- Motivation: learnings (see *_learnings tables) and banked precedents continually
-- reshape what the analyze-* edge functions produce. A new learning that corrects
-- one position can unintentionally change output for OTHER positions. The conflict
-- detector (phase 1, migration 20260417000001) warns on obviously-similar learnings
-- at write time, but it cannot catch subtle downstream regressions.
--
-- This migration adds two tables that together form a replayable test harness:
--
--   analyst_regression_cases — a curated set of contract snippets with EXPECTED
--     positions (category + summary substring to match + optional confidence /
--     market_position assertions). Each case is owned by its creator but admins
--     can see / run all cases.
--
--   analyst_regression_runs — an append-only log of each run (one row per case
--     per run). Scores match_count vs total_expected so you can trend pass rate
--     over time as learnings / precedents evolve.
--
-- Scoring is intentionally done client-side so the harness stays independent of
-- per-analyst schema differences. The DB just stores cases and results.

CREATE TABLE IF NOT EXISTS analyst_regression_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyst_type text NOT NULL CHECK (analyst_type IN ('ppa','tolling','carbon','it_supply','cloud_compute')),
  name text NOT NULL,
  description text,
  contract_snippet text NOT NULL,                  -- the excerpt to feed the analyze-* edge function
  expected_positions jsonb NOT NULL,               -- array of { category, summary_contains?, summary_regex?, confidence?, market_position? }
  analysis_config jsonb NOT NULL DEFAULT '{}'::jsonb, -- { analysisType, perspective, jurisdiction, sub_type, ... } passed into analyze-*
  source_analysis_id uuid,                         -- optional: the analysis this case was seeded from
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regression_cases_user_analyst
  ON analyst_regression_cases (user_id, analyst_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_cases_analyst_active
  ON analyst_regression_cases (analyst_type, is_active, created_at DESC)
  WHERE is_active;

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_regression_case_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_regression_case_updated_at ON analyst_regression_cases;
CREATE TRIGGER trg_touch_regression_case_updated_at BEFORE UPDATE ON analyst_regression_cases
  FOR EACH ROW EXECUTE FUNCTION touch_regression_case_updated_at();

ALTER TABLE analyst_regression_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regression_cases_select_own_or_admin" ON analyst_regression_cases;
CREATE POLICY "regression_cases_select_own_or_admin" ON analyst_regression_cases
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "regression_cases_insert_own" ON analyst_regression_cases;
CREATE POLICY "regression_cases_insert_own" ON analyst_regression_cases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "regression_cases_update_own" ON analyst_regression_cases;
CREATE POLICY "regression_cases_update_own" ON analyst_regression_cases
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "regression_cases_delete_own" ON analyst_regression_cases;
CREATE POLICY "regression_cases_delete_own" ON analyst_regression_cases
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS analyst_regression_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid NOT NULL,                            -- groups all cases run together in one suite invocation
  case_id uuid NOT NULL REFERENCES analyst_regression_cases(id) ON DELETE CASCADE,
  analyst_type text NOT NULL CHECK (analyst_type IN ('ppa','tolling','carbon','it_supply','cloud_compute')),
  status text NOT NULL CHECK (status IN ('passed','failed','partial','error')),
  match_count int NOT NULL DEFAULT 0,
  total_expected int NOT NULL DEFAULT 0,
  missed_expectations jsonb,                       -- array of expectations that had no matching actual position
  unexpected_positions jsonb,                      -- actual positions returned that didn't correspond to any expectation (informational)
  duration_ms int,
  error_message text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regression_runs_run_id
  ON analyst_regression_runs (run_id, case_id);

CREATE INDEX IF NOT EXISTS idx_regression_runs_case_created
  ON analyst_regression_runs (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_runs_analyst_status_created
  ON analyst_regression_runs (analyst_type, status, created_at DESC);

ALTER TABLE analyst_regression_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "regression_runs_select_own_or_admin" ON analyst_regression_runs;
CREATE POLICY "regression_runs_select_own_or_admin" ON analyst_regression_runs
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "regression_runs_insert_own" ON analyst_regression_runs;
CREATE POLICY "regression_runs_insert_own" ON analyst_regression_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Runs are append-only (no UPDATE/DELETE policy). Provides durable trend data.
