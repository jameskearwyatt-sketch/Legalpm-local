-- Add local counsel fields to wip_shaping_proposals table
ALTER TABLE public.wip_shaping_proposals
ADD COLUMN lc_wip_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN lc_billed_amount numeric NOT NULL DEFAULT 0;