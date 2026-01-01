-- Add column to track how local counsel fees are billed
ALTER TABLE public.matters 
ADD COLUMN local_counsel_billing TEXT DEFAULT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN public.matters.local_counsel_billing IS 'How local counsel fees are billed: Direct (to client) or Disb (as disbursement through BM)';