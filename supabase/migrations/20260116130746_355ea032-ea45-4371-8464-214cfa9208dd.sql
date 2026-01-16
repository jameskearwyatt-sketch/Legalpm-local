-- Add must_do_today column to quick_tasks table
ALTER TABLE public.quick_tasks 
ADD COLUMN must_do_today BOOLEAN NOT NULL DEFAULT false;

-- Add must_do_today column to growth_tasks table
ALTER TABLE public.growth_tasks 
ADD COLUMN must_do_today BOOLEAN NOT NULL DEFAULT false;