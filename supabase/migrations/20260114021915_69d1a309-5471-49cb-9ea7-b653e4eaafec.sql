-- Add linked_matter_id to pricing_proposals to track which matter the proposal was sent to
ALTER TABLE public.pricing_proposals 
ADD COLUMN linked_matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_pricing_proposals_linked_matter ON public.pricing_proposals(linked_matter_id);