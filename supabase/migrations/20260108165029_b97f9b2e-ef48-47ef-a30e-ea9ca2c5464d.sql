-- Create enum types for Eisenhower triage
CREATE TYPE public.task_importance AS ENUM ('important', 'not_important', 'unset');
CREATE TYPE public.task_urgency AS ENUM ('urgent', 'not_urgent', 'unset');
CREATE TYPE public.task_effort AS ENUM ('quick_win', 'deep_work', 'unset');

-- Add new columns to growth_tasks
ALTER TABLE public.growth_tasks
ADD COLUMN importance public.task_importance NOT NULL DEFAULT 'unset',
ADD COLUMN urgency public.task_urgency NOT NULL DEFAULT 'unset',
ADD COLUMN effort public.task_effort NOT NULL DEFAULT 'unset';

-- Migrate existing is_urgent=true tasks to urgency='urgent' (backwards compat)
-- Note: The growth_tasks table doesn't have is_urgent, but quick_tasks does
-- For growth_tasks, we start fresh with unset values

-- Create an index for efficient sorting by triage status
CREATE INDEX idx_growth_tasks_triage ON public.growth_tasks (user_id, is_completed, urgency, importance, effort);