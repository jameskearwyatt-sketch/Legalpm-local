-- Add detail column to pricing_proposal_items for storing full work item descriptions
ALTER TABLE public.pricing_proposal_items 
ADD COLUMN detail TEXT;