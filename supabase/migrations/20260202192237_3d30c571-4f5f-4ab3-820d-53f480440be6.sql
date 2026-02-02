-- Add phase_id column to pricing_proposal_items to support grouping items by phase
ALTER TABLE public.pricing_proposal_items 
ADD COLUMN phase_id TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.pricing_proposal_items.phase_id IS 'Optional phase identifier for grouping work items. NULL means unassigned (shows in Unassigned section).';