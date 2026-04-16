-- Dated write-off events.
--
-- Previously write-offs lived only as a cumulative column (`wip_write_off_amount`)
-- on the latest financial_snapshots row per matter. That made it impossible to
-- bucket write-offs by financial year in the dashboard — the UI was forced to
-- attribute *all* of a matter's historical write-offs to the date of its latest
-- snapshot, and any matter whose snapshot had a null/empty `as_of_date` landed
-- in an "FY NaN" bucket.
--
-- This migration introduces a dedicated, dated event table, populated
-- automatically whenever a snapshot is inserted/updated and `wip_write_off_amount`
-- increases. Each event carries the amount written off in that period, the
-- snapshot date as the write-off date, and the matter's currency + exchange
-- rate at the time so downstream USD conversion is accurate.
--
-- Existing cumulative write-offs are seeded as a single event per matter using
-- the matter's latest snapshot date (all current data is within FY 2026, per
-- the user's confirmation, so this is correct for reporting purposes).

CREATE TABLE IF NOT EXISTS public.write_off_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  write_off_amount numeric NOT NULL CHECK (write_off_amount > 0),
  fee_currency text NOT NULL DEFAULT 'GBP',
  exchange_rate numeric NOT NULL DEFAULT 1,
  write_off_date date NOT NULL,
  source_snapshot_id uuid REFERENCES public.financial_snapshots(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_off_events_matter_date
  ON public.write_off_events (matter_id, write_off_date DESC);

CREATE INDEX IF NOT EXISTS idx_write_off_events_user_date
  ON public.write_off_events (user_id, write_off_date DESC);

CREATE INDEX IF NOT EXISTS idx_write_off_events_source_snapshot
  ON public.write_off_events (source_snapshot_id)
  WHERE source_snapshot_id IS NOT NULL;

-- RLS: users see only their own events; admins see all.
ALTER TABLE public.write_off_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_write_off_events_select" ON public.write_off_events;
CREATE POLICY "own_write_off_events_select" ON public.write_off_events
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "own_write_off_events_insert" ON public.write_off_events;
CREATE POLICY "own_write_off_events_insert" ON public.write_off_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_write_off_events_update" ON public.write_off_events;
CREATE POLICY "own_write_off_events_update" ON public.write_off_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_write_off_events_delete" ON public.write_off_events;
CREATE POLICY "own_write_off_events_delete" ON public.write_off_events
  FOR DELETE USING (auth.uid() = user_id);

-- Updated-at maintenance trigger (same pattern as other tables in the project).
CREATE OR REPLACE FUNCTION public.touch_write_off_event_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_write_off_event_updated_at ON public.write_off_events;
CREATE TRIGGER trg_touch_write_off_event_updated_at
  BEFORE UPDATE ON public.write_off_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_write_off_event_updated_at();

-- Auto-populate write-off events whenever a snapshot's cumulative write-off
-- grows. Runs AFTER the snapshot write so NEW.id is finalised. Uses
-- SECURITY DEFINER because the trigger needs to INSERT into write_off_events
-- even when the caller doesn't have direct INSERT rights on that table — the
-- INSERT still respects user_id scoping because we use NEW.user_id which was
-- set by the caller's authenticated session.
CREATE OR REPLACE FUNCTION public.record_write_off_event_from_snapshot() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prior_writeoff numeric := 0;
  delta numeric := 0;
  matter_currency text;
  matter_exchange numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(wip_write_off_amount, 0)
      INTO prior_writeoff
      FROM public.financial_snapshots
      WHERE matter_id = NEW.matter_id
        AND as_of_date < NEW.as_of_date
        AND id <> NEW.id
      ORDER BY as_of_date DESC
      LIMIT 1;

    delta := COALESCE(NEW.wip_write_off_amount, 0) - COALESCE(prior_writeoff, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    delta := COALESCE(NEW.wip_write_off_amount, 0) - COALESCE(OLD.wip_write_off_amount, 0);
  ELSE
    RETURN NEW;
  END IF;

  IF delta > 0 THEN
    SELECT fee_currency, COALESCE(exchange_rate, 1)
      INTO matter_currency, matter_exchange
      FROM public.matters
      WHERE id = NEW.matter_id;

    INSERT INTO public.write_off_events (
      matter_id,
      user_id,
      write_off_amount,
      fee_currency,
      exchange_rate,
      write_off_date,
      source_snapshot_id,
      description
    ) VALUES (
      NEW.matter_id,
      NEW.user_id,
      delta,
      COALESCE(matter_currency, 'GBP'),
      COALESCE(matter_exchange, 1),
      NEW.as_of_date,
      NEW.id,
      'Auto-recorded from snapshot ' || TG_OP
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_write_off_event ON public.financial_snapshots;
CREATE TRIGGER trg_record_write_off_event
  AFTER INSERT OR UPDATE ON public.financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.record_write_off_event_from_snapshot();

-- Seed existing write-offs: one event per matter, dated to that matter's
-- latest snapshot. Per the user's confirmation all existing write-offs fall in
-- FY 2026, so per-period reconstruction is unnecessary — the cumulative total
-- lands in the correct financial year regardless.
INSERT INTO public.write_off_events (
  matter_id,
  user_id,
  write_off_amount,
  fee_currency,
  exchange_rate,
  write_off_date,
  source_snapshot_id,
  description
)
SELECT DISTINCT ON (s.matter_id)
  s.matter_id,
  s.user_id,
  s.wip_write_off_amount,
  COALESCE(m.fee_currency, 'GBP'),
  COALESCE(m.exchange_rate, 1),
  s.as_of_date,
  s.id,
  'Seeded from latest snapshot during write_off_events migration'
FROM public.financial_snapshots s
JOIN public.matters m ON m.id = s.matter_id
WHERE s.wip_write_off_amount IS NOT NULL
  AND s.wip_write_off_amount > 0
ORDER BY s.matter_id, s.as_of_date DESC;
