-- Add lower and upper estimate columns to pricing_proposal_items
ALTER TABLE public.pricing_proposal_items 
ADD COLUMN fee_lower numeric NOT NULL DEFAULT 0,
ADD COLUMN fee_upper numeric NOT NULL DEFAULT 0;

-- Update existing rows: for AI/calculated items use ±10% spread, for manual items use same value for both
UPDATE public.pricing_proposal_items 
SET 
  fee_lower = CASE 
    WHEN pricing_method IN ('ai_suggested', 'pricing_tool') THEN ROUND(fee_amount * 0.9)
    ELSE fee_amount 
  END,
  fee_upper = CASE 
    WHEN pricing_method IN ('ai_suggested', 'pricing_tool') THEN ROUND(fee_amount * 1.1)
    ELSE fee_amount 
  END;