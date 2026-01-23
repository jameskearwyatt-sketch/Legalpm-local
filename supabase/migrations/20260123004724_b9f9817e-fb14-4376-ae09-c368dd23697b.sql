-- Add columns to track contact classification for law firms and consultants
ALTER TABLE public.distribution_contacts
ADD COLUMN IF NOT EXISTS is_law_firm boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS is_consultant boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS classification_reason text DEFAULT null,
ADD COLUMN IF NOT EXISTS classified_at timestamptz DEFAULT null;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_distribution_contacts_is_law_firm 
ON public.distribution_contacts (is_law_firm) 
WHERE is_law_firm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_contacts_is_consultant 
ON public.distribution_contacts (is_consultant) 
WHERE is_consultant IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.distribution_contacts.is_law_firm IS 'AI-determined: true if contact works at a law firm';
COMMENT ON COLUMN public.distribution_contacts.is_consultant IS 'AI-determined: true if contact is a consultant (lawyers, accountants, tax advisors, architects, etc.)';
COMMENT ON COLUMN public.distribution_contacts.classification_reason IS 'AI explanation for the classification';
COMMENT ON COLUMN public.distribution_contacts.classified_at IS 'When the contact was classified by AI';