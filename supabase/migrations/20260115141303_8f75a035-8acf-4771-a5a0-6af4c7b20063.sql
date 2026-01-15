-- Table to track snapshot changes made by each master WIP update
-- This enables true revert functionality by storing "before" values
CREATE TABLE public.master_wip_snapshot_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wip_update_id UUID NOT NULL REFERENCES public.detailed_wip_updates(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES public.financial_snapshots(id) ON DELETE SET NULL,
  was_new_snapshot BOOLEAN NOT NULL DEFAULT false,
  -- Before values (null if was_new_snapshot = true)
  before_wip_amount NUMERIC DEFAULT 0,
  before_billed_amount NUMERIC DEFAULT 0,
  before_paid_amount NUMERIC DEFAULT 0,
  before_accounts_receivable NUMERIC DEFAULT 0,
  before_wip_write_off_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.master_wip_snapshot_changes ENABLE ROW LEVEL SECURITY;

-- RLS policy - users can manage changes linked to their own WIP updates
CREATE POLICY "Users can manage own snapshot changes"
  ON public.master_wip_snapshot_changes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.detailed_wip_updates
      WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id
      AND detailed_wip_updates.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.detailed_wip_updates
      WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id
      AND detailed_wip_updates.user_id = auth.uid()
    )
  );

-- Index for efficient lookups
CREATE INDEX idx_master_wip_snapshot_changes_wip_update_id 
  ON public.master_wip_snapshot_changes(wip_update_id);

CREATE INDEX idx_master_wip_snapshot_changes_matter_id 
  ON public.master_wip_snapshot_changes(matter_id);