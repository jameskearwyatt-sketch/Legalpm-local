-- Add on_slate column to quick_tasks for the Slate feature
ALTER TABLE public.quick_tasks
ADD COLUMN on_slate BOOLEAN NOT NULL DEFAULT false;