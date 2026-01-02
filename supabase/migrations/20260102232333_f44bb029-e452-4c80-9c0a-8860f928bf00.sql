-- Add WIP tracking columns to budget_line_items
ALTER TABLE public.budget_line_items 
ADD COLUMN wip_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN wip_updated_at timestamp with time zone;