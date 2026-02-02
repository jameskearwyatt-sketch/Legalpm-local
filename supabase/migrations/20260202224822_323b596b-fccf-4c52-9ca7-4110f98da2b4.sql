-- Add internal_input_dept column to pricing_proposal_items table
-- This stores which internal BM department needs to provide input on this work item
-- Per-proposal department list is dynamically built from all unique values in items
ALTER TABLE public.pricing_proposal_items 
ADD COLUMN internal_input_dept text DEFAULT NULL;