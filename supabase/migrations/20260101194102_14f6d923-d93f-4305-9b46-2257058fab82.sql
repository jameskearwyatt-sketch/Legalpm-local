-- Add optional scope item columns to budget_line_items
ALTER TABLE public.budget_line_items 
ADD COLUMN is_optional boolean NOT NULL DEFAULT false,
ADD COLUMN is_included boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.budget_line_items.is_optional IS 'Whether this line item is an optional scope item that client can opt into';
COMMENT ON COLUMN public.budget_line_items.is_included IS 'Whether this optional item is currently included in the budget totals';