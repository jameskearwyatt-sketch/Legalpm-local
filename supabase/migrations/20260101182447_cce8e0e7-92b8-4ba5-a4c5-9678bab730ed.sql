-- Add local counsel financial tracking fields to matters table
ALTER TABLE public.matters
ADD COLUMN lc_wip numeric NOT NULL DEFAULT 0,
ADD COLUMN lc_billed numeric NOT NULL DEFAULT 0,
ADD COLUMN lc_last_updated date;