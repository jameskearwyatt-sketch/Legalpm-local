-- Add is_pc_sum column to pricing_proposal_items table
-- PC Sum (Provisional Contract Sum) indicates scope is unclear and estimate is highly provisional
ALTER TABLE public.pricing_proposal_items 
ADD COLUMN is_pc_sum boolean NOT NULL DEFAULT false;