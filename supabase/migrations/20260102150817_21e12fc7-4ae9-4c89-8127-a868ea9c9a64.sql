-- Add iterative pricing fields to pricing_proposal_items
ALTER TABLE public.pricing_proposal_items
ADD COLUMN partner_hours numeric NOT NULL DEFAULT 0,
ADD COLUMN associate_hours numeric NOT NULL DEFAULT 0,
ADD COLUMN num_turns integer NOT NULL DEFAULT 1,
ADD COLUMN item_type text NOT NULL DEFAULT 'documentation';