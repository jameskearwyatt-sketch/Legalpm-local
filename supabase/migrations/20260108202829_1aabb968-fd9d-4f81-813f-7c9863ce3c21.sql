-- Add on_slate column to growth_tasks for Slate feature
ALTER TABLE public.growth_tasks
ADD COLUMN on_slate BOOLEAN NOT NULL DEFAULT false;