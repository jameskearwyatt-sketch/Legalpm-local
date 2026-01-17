-- Add jurisdictions column to matters table as a text array
ALTER TABLE public.matters 
ADD COLUMN jurisdictions text[] DEFAULT ARRAY[]::text[];