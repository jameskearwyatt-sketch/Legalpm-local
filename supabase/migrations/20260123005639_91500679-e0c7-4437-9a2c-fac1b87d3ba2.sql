-- Add column to track whether EMI focus areas were manually edited
ALTER TABLE public.distribution_contacts 
ADD COLUMN emi_focus_areas_manual_edit BOOLEAN NOT NULL DEFAULT false;