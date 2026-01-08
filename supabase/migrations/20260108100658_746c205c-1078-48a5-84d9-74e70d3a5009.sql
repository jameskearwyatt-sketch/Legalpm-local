-- Add billing_mode column to matter_local_counsels table
-- This allows tracking billing mode per local counsel (Direct vs Disbursement)
ALTER TABLE public.matter_local_counsels 
ADD COLUMN billing_mode TEXT DEFAULT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN public.matter_local_counsels.billing_mode IS 'How this local counsel fees are billed: Direct (to client) or Disb (as disbursement through BM)';