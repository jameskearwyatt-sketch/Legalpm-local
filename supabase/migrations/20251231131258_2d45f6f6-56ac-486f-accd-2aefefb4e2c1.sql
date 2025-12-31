-- Create budget_versions table to track finalized budgets and updates
CREATE TABLE public.budget_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  bm_total NUMERIC NOT NULL DEFAULT 0,
  local_counsel_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create budget_line_items table to store individual work items
CREATE TABLE public.budget_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_version_id UUID NOT NULL REFERENCES public.budget_versions(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL,
  user_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('Baker McKenzie', 'Local Counsel')),
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for budget_versions
CREATE POLICY "Users can manage own budget versions"
ON public.budget_versions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for budget_line_items
CREATE POLICY "Users can manage own budget line items"
ON public.budget_line_items
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_budget_versions_matter_id ON public.budget_versions(matter_id);
CREATE INDEX idx_budget_line_items_budget_version_id ON public.budget_line_items(budget_version_id);
CREATE INDEX idx_budget_line_items_matter_id ON public.budget_line_items(matter_id);

-- Add trigger for updating updated_at on budget_line_items
CREATE TRIGGER update_budget_line_items_updated_at
BEFORE UPDATE ON public.budget_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();