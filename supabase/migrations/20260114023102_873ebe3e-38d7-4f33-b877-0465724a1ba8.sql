-- Add missing local counsel columns to budget_line_items table
ALTER TABLE public.budget_line_items 
ADD COLUMN lc_country TEXT,
ADD COLUMN lc_currency TEXT,
ADD COLUMN lc_library_id UUID;