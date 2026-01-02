-- Create table to store detailed WIP update history
CREATE TABLE public.detailed_wip_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_wip_amount NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store line item WIP values for each update
CREATE TABLE public.detailed_wip_update_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  budget_line_item_id UUID NOT NULL,
  work_item TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT,
  lc_firm_name TEXT,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  wip_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.detailed_wip_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detailed_wip_update_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for detailed_wip_updates
CREATE POLICY "Users can manage own detailed WIP updates"
  ON public.detailed_wip_updates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for detailed_wip_update_items (via parent)
CREATE POLICY "Users can manage own WIP update items"
  ON public.detailed_wip_update_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.detailed_wip_updates
      WHERE id = wip_update_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.detailed_wip_updates
      WHERE id = wip_update_id AND user_id = auth.uid()
    )
  );

-- Create indexes for faster queries
CREATE INDEX idx_detailed_wip_updates_matter_id ON public.detailed_wip_updates(matter_id);
CREATE INDEX idx_detailed_wip_update_items_wip_update_id ON public.detailed_wip_update_items(wip_update_id);