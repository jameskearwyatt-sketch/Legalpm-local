-- Create table to store AFA configurations for pricing proposals
CREATE TABLE public.pricing_proposal_afas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  afa_type TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  client_price NUMERIC DEFAULT 0,
  effective_rate NUMERIC DEFAULT 0,
  margin_impact_percent NUMERIC DEFAULT 0,
  client_narrative TEXT,
  is_selected_for_export BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pricing_proposal_afas ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own AFAs" 
ON public.pricing_proposal_afas 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AFAs" 
ON public.pricing_proposal_afas 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AFAs" 
ON public.pricing_proposal_afas 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AFAs" 
ON public.pricing_proposal_afas 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_pricing_proposal_afas_proposal_id ON public.pricing_proposal_afas(proposal_id);

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_proposal_afas_updated_at
BEFORE UPDATE ON public.pricing_proposal_afas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();