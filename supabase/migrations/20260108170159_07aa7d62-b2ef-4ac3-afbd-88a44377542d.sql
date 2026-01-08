-- Add triage columns to quick_tasks
-- Reusing the enums we already created for growth_tasks
ALTER TABLE public.quick_tasks
ADD COLUMN importance public.task_importance NOT NULL DEFAULT 'unset',
ADD COLUMN urgency public.task_urgency NOT NULL DEFAULT 'unset',
ADD COLUMN effort public.task_effort NOT NULL DEFAULT 'unset';

-- Migrate existing is_urgent=true tasks to urgency='urgent'
UPDATE public.quick_tasks 
SET urgency = 'urgent' 
WHERE is_urgent = true;

-- Create an index for efficient sorting by triage status
CREATE INDEX idx_quick_tasks_triage ON public.quick_tasks (user_id, is_completed, urgency, importance, effort);