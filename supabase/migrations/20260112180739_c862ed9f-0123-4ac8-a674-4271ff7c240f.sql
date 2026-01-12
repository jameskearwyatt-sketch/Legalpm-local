-- Add write_off_amount to detailed_wip_update_items for per-item write-offs
ALTER TABLE public.detailed_wip_update_items 
ADD COLUMN write_off_amount NUMERIC NOT NULL DEFAULT 0;

-- Add total_write_off_amount to detailed_wip_updates for aggregate tracking
ALTER TABLE public.detailed_wip_updates 
ADD COLUMN total_write_off_amount NUMERIC NOT NULL DEFAULT 0;

-- Add wip_write_off column to budget_line_items for current write-off tracking
ALTER TABLE public.budget_line_items 
ADD COLUMN wip_write_off NUMERIC NOT NULL DEFAULT 0;

-- Add aggregate write-off column to financial_snapshots for historical tracking
ALTER TABLE public.financial_snapshots 
ADD COLUMN wip_write_off_amount NUMERIC NOT NULL DEFAULT 0;