-- Add EMI Focus Areas column to distribution_contacts
ALTER TABLE public.distribution_contacts 
ADD COLUMN emi_focus_areas TEXT[] NOT NULL DEFAULT '{}';

-- Add column to track when focus areas were last assigned
ALTER TABLE public.distribution_contacts 
ADD COLUMN emi_focus_areas_assigned_at TIMESTAMP WITH TIME ZONE;