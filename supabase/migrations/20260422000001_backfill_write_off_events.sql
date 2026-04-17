-- Backfill write_off_events from existing financial_snapshots.
--
-- The 20260421 migration created the table + trigger + seed query, but if
-- the migration was applied to a DB that already had snapshots with write-offs
-- before the trigger existed, or was never applied at all, the events table
-- will be empty.  This migration is idempotent: it only inserts for matters
-- that have write-offs in their latest snapshot but no corresponding row in
-- write_off_events yet.

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
  'Backfill: seeded from latest snapshot (FY 2026)'
FROM public.financial_snapshots s
JOIN public.matters m ON m.id = s.matter_id
WHERE s.wip_write_off_amount IS NOT NULL
  AND s.wip_write_off_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.write_off_events e
    WHERE e.matter_id = s.matter_id
  )
ORDER BY s.matter_id, s.as_of_date DESC;
