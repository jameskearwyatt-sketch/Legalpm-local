-- Create pricing_proposals table
CREATE TABLE public.pricing_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Agreed')),
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_proposal_versions table for version history
CREATE TABLE public.pricing_proposal_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  bm_total NUMERIC NOT NULL DEFAULT 0,
  local_counsel_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pricing_proposal_items table for work items
CREATE TABLE public.pricing_proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES public.pricing_proposal_versions(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'Baker McKenzie',
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  pricing_method TEXT NOT NULL DEFAULT 'manual' CHECK (pricing_method IN ('ai_suggested', 'pricing_tool', 'manual')),
  category TEXT,
  lc_firm_name TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  is_included BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ai_rationale TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for version numbers per proposal
CREATE UNIQUE INDEX pricing_proposal_versions_unique_version 
ON public.pricing_proposal_versions(proposal_id, version_number);

-- Enable RLS
ALTER TABLE public.pricing_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_proposal_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_proposals
CREATE POLICY "Users can manage own pricing proposals" 
ON public.pricing_proposals 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for pricing_proposal_versions
CREATE POLICY "Users can manage own pricing proposal versions" 
ON public.pricing_proposal_versions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for pricing_proposal_items
CREATE POLICY "Users can manage own pricing proposal items" 
ON public.pricing_proposal_items 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger for pricing_proposals
CREATE TRIGGER update_pricing_proposals_updated_at
BEFORE UPDATE ON public.pricing_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for pricing_proposal_items
CREATE TRIGGER update_pricing_proposal_items_updated_at
BEFORE UPDATE ON public.pricing_proposal_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();