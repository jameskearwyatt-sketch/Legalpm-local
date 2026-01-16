-- Create table for WIP shaping proposals
CREATE TABLE public.wip_shaping_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL,
  
  -- Financial fields (same as financial_snapshots)
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  wip_write_off_amount NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  accounts_receivable NUMERIC NOT NULL DEFAULT 0,
  
  -- Status: 'active' or 'archived'
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Is this the currently selected proposal for this matter?
  is_selected BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add column to matters to track if we should show the proposal instead of real snapshot
ALTER TABLE public.matters ADD COLUMN show_shaping_proposal BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS
ALTER TABLE public.wip_shaping_proposals ENABLE ROW LEVEL SECURITY;

-- RLS policy for proposals
CREATE POLICY "Users can manage own WIP shaping proposals"
ON public.wip_shaping_proposals
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_wip_shaping_proposals_updated_at
BEFORE UPDATE ON public.wip_shaping_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient lookup
CREATE INDEX idx_wip_shaping_proposals_matter_id ON public.wip_shaping_proposals(matter_id);
CREATE INDEX idx_wip_shaping_proposals_selected ON public.wip_shaping_proposals(matter_id, is_selected) WHERE is_selected = true;