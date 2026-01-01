-- Create table for tracking individual local counsel firms per matter
CREATE TABLE public.matter_local_counsels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  firm_name TEXT NOT NULL,
  allocated_budget NUMERIC NOT NULL DEFAULT 0,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  last_updated DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(matter_id, firm_name)
);

-- Enable RLS
ALTER TABLE public.matter_local_counsels ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage own matter local counsels"
ON public.matter_local_counsels
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_matter_local_counsels_updated_at
BEFORE UPDATE ON public.matter_local_counsels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add lc_firm_name column to budget_line_items to track which LC firm a line item belongs to
ALTER TABLE public.budget_line_items 
ADD COLUMN lc_firm_name TEXT;