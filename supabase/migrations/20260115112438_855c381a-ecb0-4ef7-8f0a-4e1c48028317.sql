-- Add accounts_receivable column to financial_snapshots table
-- This will store outstanding bills (unpaid invoices) separately from total billed
ALTER TABLE public.financial_snapshots 
ADD COLUMN accounts_receivable numeric NOT NULL DEFAULT 0;

-- Migrate existing data: set accounts_receivable = billed_amount - paid_amount for existing records
-- This maintains backward compatibility with existing snapshots
UPDATE public.financial_snapshots 
SET accounts_receivable = GREATEST(billed_amount - paid_amount, 0);

-- Add comment for clarity
COMMENT ON COLUMN public.financial_snapshots.accounts_receivable IS 'Outstanding bills not yet paid (entered manually)';