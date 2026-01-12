-- Add completion_notes column to quick_tasks table
ALTER TABLE public.quick_tasks 
ADD COLUMN completion_notes TEXT;