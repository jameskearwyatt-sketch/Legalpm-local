-- Add is_urgent column to quick_tasks
ALTER TABLE public.quick_tasks 
ADD COLUMN is_urgent BOOLEAN NOT NULL DEFAULT false;