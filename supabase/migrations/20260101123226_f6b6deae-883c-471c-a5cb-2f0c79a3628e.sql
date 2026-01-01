-- Create a table for matter assumptions extracted from engagement letters
CREATE TABLE public.matter_assumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  assumption_text TEXT NOT NULL,
  source_document TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries by matter
CREATE INDEX idx_matter_assumptions_matter_id ON public.matter_assumptions(matter_id);

-- Enable Row Level Security
ALTER TABLE public.matter_assumptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user access
CREATE POLICY "Users can manage own matter assumptions"
ON public.matter_assumptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_matter_assumptions_updated_at
BEFORE UPDATE ON public.matter_assumptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add a comment explaining the standard assumption labels
COMMENT ON TABLE public.matter_assumptions IS 'Stores assumptions extracted from engagement letters. Standard labels: Document Revisions, Transaction Scope, Negotiation Style, Timeline, Counterparty Cooperation, Jurisdiction, Due Diligence, Third Party Involvement, Regulatory Approvals, Complexity Level, Language, Disputes';