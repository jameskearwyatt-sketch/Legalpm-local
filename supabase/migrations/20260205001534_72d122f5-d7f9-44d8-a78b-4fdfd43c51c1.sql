
-- Change the foreign key constraint from SET NULL to CASCADE
-- This ensures precedent bank entries are automatically deleted when their source analysis is deleted

-- First drop the existing constraint
ALTER TABLE public.ppa_precedent_bank 
DROP CONSTRAINT IF EXISTS ppa_precedent_bank_source_analysis_id_fkey;

-- Recreate with CASCADE delete
ALTER TABLE public.ppa_precedent_bank
ADD CONSTRAINT ppa_precedent_bank_source_analysis_id_fkey 
FOREIGN KEY (source_analysis_id) 
REFERENCES public.ppa_analyses(id) 
ON DELETE CASCADE;
