-- Add write-off mode to wip_shaping_proposals
-- 'fixed_writeoff' = current behavior (static write-off amount)
-- 'fixed_target' = store a target adjusted WIP, derive write-off dynamically
ALTER TABLE public.wip_shaping_proposals
ADD COLUMN write_off_mode text NOT NULL DEFAULT 'fixed_writeoff',
ADD COLUMN wip_target_amount numeric DEFAULT 0;

-- Add a check constraint for valid modes
ALTER TABLE public.wip_shaping_proposals
ADD CONSTRAINT valid_write_off_mode CHECK (write_off_mode IN ('fixed_writeoff', 'fixed_target'));