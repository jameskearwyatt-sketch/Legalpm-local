-- Add gold standard support to precedent bank
ALTER TABLE public.ppa_precedent_bank 
ADD COLUMN IF NOT EXISTS is_gold_standard boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS template_name text,
ADD COLUMN IF NOT EXISTS template_description text;

-- Add index for efficient gold standard lookups
CREATE INDEX IF NOT EXISTS idx_ppa_precedent_bank_gold_standard 
ON public.ppa_precedent_bank (is_gold_standard) 
WHERE is_gold_standard = true;

-- Add comment for clarity
COMMENT ON COLUMN public.ppa_precedent_bank.is_gold_standard IS 'True for firm template precedents that should always be compared against';
COMMENT ON COLUMN public.ppa_precedent_bank.template_name IS 'Name of the template (e.g., Baker McKenzie EU VPPA Template)';
COMMENT ON COLUMN public.ppa_precedent_bank.template_description IS 'Description of the template source';