-- Add separate AR write-off column to wip_shaping_proposals
-- Rename existing column to be explicit about WIP write-offs only
ALTER TABLE public.wip_shaping_proposals 
ADD COLUMN ar_write_off_amount numeric NOT NULL DEFAULT 0;

-- Note: The existing wip_write_off_amount will now store only WIP write-offs
-- We'll need to update the application code to handle this correctly