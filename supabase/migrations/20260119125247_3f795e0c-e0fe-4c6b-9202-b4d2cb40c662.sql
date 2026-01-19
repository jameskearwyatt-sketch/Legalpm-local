-- Add manual budget override fields to the matters table
ALTER TABLE public.matters 
ADD COLUMN IF NOT EXISTS use_manual_budget BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_budget_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.matters.use_manual_budget IS 'When true, the app uses manual_budget_amount instead of calculating from budget line items';
COMMENT ON COLUMN public.matters.manual_budget_amount IS 'Manual budget override value used when use_manual_budget is true';