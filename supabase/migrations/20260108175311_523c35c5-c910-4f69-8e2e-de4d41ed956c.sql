-- Add pinned_to_tasklist column to growth_tasks
ALTER TABLE public.growth_tasks 
ADD COLUMN pinned_to_tasklist BOOLEAN NOT NULL DEFAULT false;