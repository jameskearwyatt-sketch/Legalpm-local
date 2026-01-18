-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage own snapshot changes" ON public.master_wip_snapshot_changes;

-- Create separate policies for each operation to debug
-- For INSERT: Allow if user owns the referenced detailed_wip_updates record
CREATE POLICY "Users can insert snapshot changes" 
ON public.master_wip_snapshot_changes 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates 
    WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id 
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

-- For SELECT: Allow if user owns the referenced detailed_wip_updates record
CREATE POLICY "Users can view own snapshot changes" 
ON public.master_wip_snapshot_changes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates 
    WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id 
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

-- For UPDATE: Allow if user owns the referenced detailed_wip_updates record
CREATE POLICY "Users can update own snapshot changes" 
ON public.master_wip_snapshot_changes 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates 
    WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id 
    AND detailed_wip_updates.user_id = auth.uid()
  )
);

-- For DELETE: Allow if user owns the referenced detailed_wip_updates record
CREATE POLICY "Users can delete own snapshot changes" 
ON public.master_wip_snapshot_changes 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.detailed_wip_updates 
    WHERE detailed_wip_updates.id = master_wip_snapshot_changes.wip_update_id 
    AND detailed_wip_updates.user_id = auth.uid()
  )
);