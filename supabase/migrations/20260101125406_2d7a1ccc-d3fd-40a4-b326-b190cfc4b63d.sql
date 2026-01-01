-- Add is_standard column to support mining/reuse of assumptions
ALTER TABLE public.matter_assumptions 
ADD COLUMN IF NOT EXISTS is_standard boolean NOT NULL DEFAULT false;

-- Add index for efficient querying of standard assumptions
CREATE INDEX IF NOT EXISTS idx_matter_assumptions_is_standard 
ON public.matter_assumptions (is_standard) 
WHERE is_standard = true;