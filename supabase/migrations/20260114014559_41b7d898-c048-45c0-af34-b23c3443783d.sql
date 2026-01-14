-- Create a global local counsel library table for reuse across any proposal
CREATE TABLE public.local_counsel_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  firm_name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  rate_card JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, firm_name, country)
);

-- Enable RLS
ALTER TABLE public.local_counsel_library ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage own local counsel library"
ON public.local_counsel_library
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_local_counsel_library_updated_at
BEFORE UPDATE ON public.local_counsel_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to pricing_proposal_items for local counsel details
ALTER TABLE public.pricing_proposal_items
ADD COLUMN lc_country TEXT DEFAULT NULL,
ADD COLUMN lc_currency TEXT DEFAULT NULL,
ADD COLUMN lc_library_id UUID DEFAULT NULL;