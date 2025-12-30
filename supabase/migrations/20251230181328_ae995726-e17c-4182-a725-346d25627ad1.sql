-- Create budget_amendments table to track budget update history
CREATE TABLE public.budget_amendments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amendment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_budget NUMERIC NOT NULL DEFAULT 0,
  new_budget NUMERIC NOT NULL DEFAULT 0,
  previous_bm_fee NUMERIC NOT NULL DEFAULT 0,
  new_bm_fee NUMERIC NOT NULL DEFAULT 0,
  previous_local_counsel NUMERIC NOT NULL DEFAULT 0,
  new_local_counsel NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.budget_amendments ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage own budget amendments" 
ON public.budget_amendments 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_budget_amendments_matter_id ON public.budget_amendments(matter_id);