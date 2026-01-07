-- Create a simple bills table for tracking billed amounts
CREATE TABLE public.matter_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matter_bills ENABLE ROW LEVEL SECURITY;

-- Create policy for user access
CREATE POLICY "Users can manage own matter bills"
ON public.matter_bills
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_matter_bills_matter_id ON public.matter_bills(matter_id);