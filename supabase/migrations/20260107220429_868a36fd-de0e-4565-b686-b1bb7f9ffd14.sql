-- Add field to track matters where client pays full time costs (no estimate/headroom tracking)
ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS pay_full_time_costs boolean NOT NULL DEFAULT false;