
-- Add facility_stage to tolling_analyses
ALTER TABLE public.tolling_analyses 
ADD COLUMN IF NOT EXISTS facility_stage text DEFAULT NULL;

-- Add facility_stage to tolling_precedent_bank
ALTER TABLE public.tolling_precedent_bank 
ADD COLUMN IF NOT EXISTS facility_stage text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tolling_analyses.facility_stage IS 'development, construction, or operating';
COMMENT ON COLUMN public.tolling_precedent_bank.facility_stage IS 'development, construction, or operating';
