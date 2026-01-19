-- Create table to store individual local counsel adjustments for WIP shaping proposals
CREATE TABLE public.wip_proposal_local_counsels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.wip_shaping_proposals(id) ON DELETE CASCADE,
  local_counsel_id UUID NOT NULL REFERENCES public.matter_local_counsels(id) ON DELETE CASCADE,
  firm_name TEXT NOT NULL,
  
  -- Raw values (actual current values from matter_local_counsels)
  raw_wip_amount NUMERIC NOT NULL DEFAULT 0,
  raw_billed_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Proposed adjusted values
  proposed_wip_amount NUMERIC NOT NULL DEFAULT 0,
  proposed_billed_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Write-off amounts (calculated: raw - proposed)
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  billed_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Each local counsel can only appear once per proposal
  UNIQUE(proposal_id, local_counsel_id)
);

-- Enable RLS
ALTER TABLE public.wip_proposal_local_counsels ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own proposals' local counsel data
CREATE POLICY "Users can view their own proposal local counsels"
ON public.wip_proposal_local_counsels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.wip_shaping_proposals p
    WHERE p.id = wip_proposal_local_counsels.proposal_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own proposal local counsels"
ON public.wip_proposal_local_counsels
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.wip_shaping_proposals p
    WHERE p.id = wip_proposal_local_counsels.proposal_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own proposal local counsels"
ON public.wip_proposal_local_counsels
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.wip_shaping_proposals p
    WHERE p.id = wip_proposal_local_counsels.proposal_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own proposal local counsels"
ON public.wip_proposal_local_counsels
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.wip_shaping_proposals p
    WHERE p.id = wip_proposal_local_counsels.proposal_id
    AND p.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_wip_proposal_local_counsels_updated_at
BEFORE UPDATE ON public.wip_proposal_local_counsels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();