-- Structured position-level feedback tags (Analyst Suite improvement #8).
--
-- When an attorney teaches the AI via the TeachFeedbackDialog, their correction
-- is stored as free-text in `corrected_position` + `correction_reason`. That's
-- fine for carrying the narrative into future prompts, but it makes it hard to
-- answer "what *kind* of mistake did the AI make most often in the last month?"
-- without re-parsing the prose. This migration adds a structured
-- `feedback_type` column to all five *_learnings tables so each correction can
-- be tagged with one of a small set of well-known error modes. The column is
-- nullable: historical rows stay valid, and the selector in the UI defaults to
-- unset so users aren't forced to classify if they just want to correct the
-- wording.
--
-- Allowed values (enforced by CHECK, not an enum, so we can add values without
-- ALTER TYPE dances):
--   wrong_category          — the position was mis-categorised
--   wrong_summary           — the summary misrepresents what the clause says
--   wrong_market_assessment — the market-position / favorability label is off
--   missing_context         — the summary is correct but incomplete
--   wrong_confidence        — the confidence level is over/understated
--   other                   — doesn't fit one of the above
--
-- Partial indexes on `(feedback_type)` keep future aggregation cheap without
-- bloating the index when the column is mostly null.

ALTER TABLE public.ppa_ai_learnings
  ADD COLUMN IF NOT EXISTS feedback_type text
  CHECK (feedback_type IS NULL OR feedback_type IN (
    'wrong_category', 'wrong_summary', 'wrong_market_assessment',
    'missing_context', 'wrong_confidence', 'other'
  ));

ALTER TABLE public.tolling_learnings
  ADD COLUMN IF NOT EXISTS feedback_type text
  CHECK (feedback_type IS NULL OR feedback_type IN (
    'wrong_category', 'wrong_summary', 'wrong_market_assessment',
    'missing_context', 'wrong_confidence', 'other'
  ));

ALTER TABLE public.carbon_learnings
  ADD COLUMN IF NOT EXISTS feedback_type text
  CHECK (feedback_type IS NULL OR feedback_type IN (
    'wrong_category', 'wrong_summary', 'wrong_market_assessment',
    'missing_context', 'wrong_confidence', 'other'
  ));

ALTER TABLE public.it_supply_learnings
  ADD COLUMN IF NOT EXISTS feedback_type text
  CHECK (feedback_type IS NULL OR feedback_type IN (
    'wrong_category', 'wrong_summary', 'wrong_market_assessment',
    'missing_context', 'wrong_confidence', 'other'
  ));

ALTER TABLE public.cloud_compute_learnings
  ADD COLUMN IF NOT EXISTS feedback_type text
  CHECK (feedback_type IS NULL OR feedback_type IN (
    'wrong_category', 'wrong_summary', 'wrong_market_assessment',
    'missing_context', 'wrong_confidence', 'other'
  ));

CREATE INDEX IF NOT EXISTS ppa_ai_learnings_feedback_type_idx
  ON public.ppa_ai_learnings (feedback_type) WHERE feedback_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS tolling_learnings_feedback_type_idx
  ON public.tolling_learnings (feedback_type) WHERE feedback_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS carbon_learnings_feedback_type_idx
  ON public.carbon_learnings (feedback_type) WHERE feedback_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS it_supply_learnings_feedback_type_idx
  ON public.it_supply_learnings (feedback_type) WHERE feedback_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS cloud_compute_learnings_feedback_type_idx
  ON public.cloud_compute_learnings (feedback_type) WHERE feedback_type IS NOT NULL;

COMMENT ON COLUMN public.ppa_ai_learnings.feedback_type IS
  'Structured tag describing what kind of error the correction addresses. Nullable — historic corrections and users who skip the selector leave this unset.';
COMMENT ON COLUMN public.tolling_learnings.feedback_type IS
  'Structured tag describing what kind of error the correction addresses. Nullable.';
COMMENT ON COLUMN public.carbon_learnings.feedback_type IS
  'Structured tag describing what kind of error the correction addresses. Nullable.';
COMMENT ON COLUMN public.it_supply_learnings.feedback_type IS
  'Structured tag describing what kind of error the correction addresses. Nullable.';
COMMENT ON COLUMN public.cloud_compute_learnings.feedback_type IS
  'Structured tag describing what kind of error the correction addresses. Nullable.';
