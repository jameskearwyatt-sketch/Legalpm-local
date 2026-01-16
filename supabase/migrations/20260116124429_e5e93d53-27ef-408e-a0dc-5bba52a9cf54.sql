-- Create table to track local counsel changes during master WIP updates
CREATE TABLE public.master_lc_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  local_counsel_id UUID NOT NULL REFERENCES public.matter_local_counsels(id) ON DELETE CASCADE,
  before_wip_amount NUMERIC DEFAULT 0,
  before_billed_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.master_lc_changes ENABLE ROW LEVEL SECURITY;

-- Create policies - users can only see their own data (via the parent wip update's user_id)
CREATE POLICY "Users can view their own LC changes"
ON public.master_lc_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates
    WHERE detailed_wip_updates.id = master_lc_changes.wip_update_id
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own LC changes"
ON public.master_lc_changes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates
    WHERE detailed_wip_updates.id = master_lc_changes.wip_update_id
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own LC changes"
ON public.master_lc_changes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates
    WHERE detailed_wip_updates.id = master_lc_changes.wip_update_id
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_master_lc_changes_wip_update_id ON public.master_lc_changes(wip_update_id);
CREATE INDEX idx_master_lc_changes_local_counsel_id ON public.master_lc_changes(local_counsel_id);