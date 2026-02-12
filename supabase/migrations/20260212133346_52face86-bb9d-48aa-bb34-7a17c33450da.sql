ALTER TABLE public.pricing_proposal_items
  ADD COLUMN assumption_linked boolean NOT NULL DEFAULT false,
  ADD COLUMN assumption_text text,
  ADD COLUMN alt_fee_lower numeric NOT NULL DEFAULT 0,
  ADD COLUMN alt_fee_upper numeric NOT NULL DEFAULT 0;