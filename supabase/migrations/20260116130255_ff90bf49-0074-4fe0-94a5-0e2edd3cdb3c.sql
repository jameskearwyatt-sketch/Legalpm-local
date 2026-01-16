-- Add must_do_today column to slate_items table
ALTER TABLE public.slate_items 
ADD COLUMN must_do_today BOOLEAN NOT NULL DEFAULT false;