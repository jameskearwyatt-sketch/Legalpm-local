-- Analyst LLM call observability log (Upgrade #7 completion)
--
-- The per-analysis row (in the 5 *_analyses tables) already captures model,
-- duration, and token counts for the main analyze call. This table records a
-- call-level audit log for EVERY LLM interaction: analyze-contract calls,
-- feedback processing, embedding calls, etc — including FAILURES, which the
-- analyses table cannot capture because no row is created on failure.
--
-- This is strictly metadata: no prompt or response content is stored, to
-- preserve attorney-client privilege. If users later need to correlate a log
-- entry with what was analysed, the `analysis_id` foreign key links to the
-- analysis row whose content they already have access to.

CREATE TABLE IF NOT EXISTS analyst_llm_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyst_type text NOT NULL CHECK (analyst_type IN ('ppa','tolling','carbon','it_supply','cloud_compute')),
  function_name text NOT NULL,                -- e.g. 'analyze-ppa-contract', 'embed-text', 'compare-ppa-drafts'
  analysis_id uuid,                            -- optional link to the resulting analysis row (nullable on failure)
  status text NOT NULL CHECK (status IN ('success','failure','partial')),
  error_type text,                             -- 'timeout', 'auth', 'server_error', 'parse_error', 'network', etc.
  error_message text,                          -- short, truncated server-side to 500 chars
  input_chars int,                             -- payload size (not content)
  input_token_count int,
  output_token_count int,
  model_used text,
  duration_ms int,
  metadata jsonb,                              -- flexible extras (perspective, analysis_type, etc.) — no PII
  created_at timestamptz NOT NULL DEFAULT now()
);

-- truncate long error messages at write time to keep the table small
CREATE OR REPLACE FUNCTION trim_llm_log_error() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.error_message IS NOT NULL AND length(NEW.error_message) > 500 THEN
    NEW.error_message := left(NEW.error_message, 500);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_llm_log_error ON analyst_llm_call_log;
CREATE TRIGGER trg_trim_llm_log_error BEFORE INSERT OR UPDATE ON analyst_llm_call_log
  FOR EACH ROW EXECUTE FUNCTION trim_llm_log_error();

CREATE INDEX IF NOT EXISTS idx_analyst_llm_call_log_user_created
  ON analyst_llm_call_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyst_llm_call_log_analyst_status
  ON analyst_llm_call_log (analyst_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyst_llm_call_log_analysis_id
  ON analyst_llm_call_log (analysis_id)
  WHERE analysis_id IS NOT NULL;

-- RLS: users only see their own logs; admins see all.
ALTER TABLE analyst_llm_call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_llm_logs_select" ON analyst_llm_call_log;
CREATE POLICY "own_llm_logs_select" ON analyst_llm_call_log
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "own_llm_logs_insert" ON analyst_llm_call_log;
CREATE POLICY "own_llm_logs_insert" ON analyst_llm_call_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No UPDATE or DELETE policy — logs are append-only. Admins can still wipe
-- via service role if required.
