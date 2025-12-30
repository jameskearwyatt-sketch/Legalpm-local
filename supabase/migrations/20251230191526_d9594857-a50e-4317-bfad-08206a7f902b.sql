-- Create junction table for multi-client matters
CREATE TABLE public.matter_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cm_number TEXT, -- Individual CM number for this client (optional except for master)
  is_master BOOLEAN NOT NULL DEFAULT false, -- True if this is the master matter where time is recorded
  fee_percentage NUMERIC NOT NULL DEFAULT 0 CHECK (fee_percentage >= 0 AND fee_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (matter_id, client_id) -- Each client can only be on a matter once
);

-- Enable Row Level Security
ALTER TABLE public.matter_clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user access
CREATE POLICY "Users can manage own matter clients"
ON public.matter_clients
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_matter_clients_updated_at
BEFORE UPDATE ON public.matter_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_multi_client flag to matters table for quick identification
ALTER TABLE public.matters ADD COLUMN is_multi_client BOOLEAN NOT NULL DEFAULT false;