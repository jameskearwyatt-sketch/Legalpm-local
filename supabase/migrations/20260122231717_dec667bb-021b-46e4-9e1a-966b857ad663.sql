-- Create contact history table to track changes (especially role/company changes)
CREATE TABLE public.distribution_contact_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.distribution_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  change_source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'enrichment', 'import'
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

-- Enable RLS
ALTER TABLE public.distribution_contact_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own contact history"
ON public.distribution_contact_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contact history"
ON public.distribution_contact_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contact history"
ON public.distribution_contact_history
FOR DELETE
USING (auth.uid() = user_id);

-- Add last_enriched_at column to distribution_contacts
ALTER TABLE public.distribution_contacts
ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries
CREATE INDEX idx_contact_history_contact_id ON public.distribution_contact_history(contact_id);
CREATE INDEX idx_contact_history_changed_at ON public.distribution_contact_history(changed_at DESC);
CREATE INDEX idx_distribution_contacts_last_enriched ON public.distribution_contacts(last_enriched_at DESC NULLS LAST);
CREATE INDEX idx_distribution_contacts_updated_at ON public.distribution_contacts(updated_at DESC);