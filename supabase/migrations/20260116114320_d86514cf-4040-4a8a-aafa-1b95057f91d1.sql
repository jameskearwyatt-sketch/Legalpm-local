-- Add columns to matter_local_counsels to track manual vs bulk updates
ALTER TABLE public.matter_local_counsels
ADD COLUMN IF NOT EXISTS update_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS wip_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billed_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comment explaining the update_source field
COMMENT ON COLUMN public.matter_local_counsels.update_source IS 'Source of last update: manual (user entered directly) or bulk (from Excel import)';
COMMENT ON COLUMN public.matter_local_counsels.wip_updated_at IS 'Timestamp of last WIP amount update';
COMMENT ON COLUMN public.matter_local_counsels.billed_updated_at IS 'Timestamp of last billed amount update';

-- Create a table to track disbursement allocations from imports
CREATE TABLE public.lc_disbursement_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  disbursement_type TEXT NOT NULL, -- 'wip', 'accounts_receivable', or 'paid'
  original_amount NUMERIC NOT NULL DEFAULT 0,
  allocated_to_lc BOOLEAN NOT NULL DEFAULT false,
  allocations JSONB DEFAULT '[]', -- Array of {local_counsel_id, firm_name, amount}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lc_disbursement_allocations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own disbursement allocations"
ON public.lc_disbursement_allocations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own disbursement allocations"
ON public.lc_disbursement_allocations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own disbursement allocations"
ON public.lc_disbursement_allocations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own disbursement allocations"
ON public.lc_disbursement_allocations
FOR DELETE
USING (auth.uid() = user_id);