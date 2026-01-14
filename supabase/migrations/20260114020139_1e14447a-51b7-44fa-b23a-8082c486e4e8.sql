-- Create a table to store local counsel quotes per work item per firm
-- This allows storing different fee estimates from competing firms for the same work item
CREATE TABLE public.lc_work_item_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  proposal_id UUID NOT NULL REFERENCES public.pricing_proposals(id) ON DELETE CASCADE,
  lc_library_id UUID NOT NULL REFERENCES public.local_counsel_library(id) ON DELETE CASCADE,
  work_item_key TEXT NOT NULL, -- Identifier for the work item within the proposal
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_lower NUMERIC NOT NULL DEFAULT 0,
  fee_upper NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint: one quote per firm per work item per proposal
  UNIQUE(proposal_id, lc_library_id, work_item_key)
);

-- Enable Row Level Security
ALTER TABLE public.lc_work_item_quotes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own LC quotes" 
ON public.lc_work_item_quotes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own LC quotes" 
ON public.lc_work_item_quotes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LC quotes" 
ON public.lc_work_item_quotes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LC quotes" 
ON public.lc_work_item_quotes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lc_work_item_quotes_updated_at
BEFORE UPDATE ON public.lc_work_item_quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();