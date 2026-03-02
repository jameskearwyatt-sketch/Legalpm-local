ALTER TABLE public.pricing_proposal_items
  ADD COLUMN is_multiplied boolean NOT NULL DEFAULT false,
  ADD COLUMN multiplier_qty integer NOT NULL DEFAULT 1;