import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface FinancialSnapshot {
  id: string;
  matter_id: string;
  user_id: string;
  as_of_date: string;
  wip_amount: number;
  wip_write_off_amount: number;
  billed_amount: number;
  accounts_receivable: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSnapshotInput {
  matter_id: string;
  as_of_date: string;
  wip_amount: number;
  wip_write_off_amount?: number;
  billed_amount: number;
  accounts_receivable: number;
  paid_amount: number;
  notes?: string;
}

export function useSnapshots(matterId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('matter_id', matterId!)
        .order('as_of_date', { ascending: false });

      if (error) throw error;
      return data as FinancialSnapshot[];
    },
    enabled: !!user && !!matterId,
    // Snapshots feed the MatterDetail trend chart. Force a fresh fetch on
    // every activation so edits/deletes anywhere in the app are reflected
    // without the user having to hard-refresh the browser.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Snapshot mutations must both refresh list views AND wipe cached chart data.
  // React Query keeps separate cache entries per queryKey (e.g. per exclusion
  // set on the dashboard, per date range on reports). Two-step strategy:
  //   1. `removeQueries` drops every cached entry for these prefixes — so any
  //      future activation (toggling exclusion checkboxes, switching date
  //      ranges, navigating back) starts from an empty cache and fetches
  //      fresh.
  //   2. `invalidateQueries` with `refetchType: 'all'` forces every CURRENTLY
  //      mounted observer (e.g. the dashboard query the user is staring at)
  //      to refetch immediately. Without this, `removeQueries` alone clears
  //      the cache but mounted observers keep their last rendered data until
  //      something else (remount, window focus) triggers a fetch — which is
  //      exactly the "deleted data still shows in graphs" bug when the user
  //      toggles between matter exclusions on the dashboard.
  const refreshAllChartAndListCaches = () => {
    queryClient.removeQueries({ queryKey: ['dashboard'] });
    queryClient.removeQueries({ queryKey: ['report-realization'] });
    queryClient.removeQueries({ queryKey: ['report-budget-burn'] });
    queryClient.removeQueries({ queryKey: ['report-wip-movement'] });
    queryClient.removeQueries({ queryKey: ['report-collection'] });
    queryClient.removeQueries({ queryKey: ['matter'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['report-realization'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['report-budget-burn'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['report-wip-movement'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['report-collection'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['snapshots'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['matters'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['matter'], refetchType: 'all' });
  };

  const createSnapshot = useMutation({
    mutationFn: async (input: CreateSnapshotInput) => {
      const { data, error } = await supabase
        .from('financial_snapshots')
        .insert({
          ...input,
          user_id: user!.id,
          created_by: user!.id,
          updated_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshAllChartAndListCaches();
      toast({ title: 'Snapshot created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create snapshot', description: error.message, variant: 'destructive' });
    },
  });

  // Upsert snapshot for today - used for bulk imports and inline editing
  // Note: update_source should be set by the caller (defaults to 'bulk' for this method)
  const upsertTodaySnapshot = useMutation({
    mutationFn: async ({ matterId, field, value, updateSource = 'bulk' }: { 
      matterId: string; 
      field: 'wip_amount' | 'wip_write_off_amount' | 'billed_amount' | 'accounts_receivable' | 'paid_amount'; 
      value: number;
      updateSource?: 'manual' | 'bulk';
    }) => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Try to update an existing snapshot for today first (avoids race condition)
      const { data: updated, error: updateError } = await supabase
        .from('financial_snapshots')
        .update({ [field]: value, updated_at: now, update_source: updateSource, updated_by: user!.id })
        .eq('matter_id', matterId)
        .eq('as_of_date', today)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      if (updated) {
        return { data: updated, matterId };
      }

      // No snapshot for today exists — get the latest to copy other values
      const { data: latestSnapshot } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('matter_id', matterId)
        .order('as_of_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Create new snapshot with today's date
      const { data: inserted, error: insertError } = await supabase
        .from('financial_snapshots')
        .insert({
          matter_id: matterId,
          user_id: user!.id,
          created_by: user!.id,
          updated_by: user!.id,
          as_of_date: today,
          wip_amount: field === 'wip_amount' ? value : (latestSnapshot?.wip_amount || 0),
          wip_write_off_amount: field === 'wip_write_off_amount' ? value : (latestSnapshot?.wip_write_off_amount || 0),
          billed_amount: field === 'billed_amount' ? value : (latestSnapshot?.billed_amount || 0),
          accounts_receivable: field === 'accounts_receivable' ? value : (latestSnapshot?.accounts_receivable || 0),
          paid_amount: field === 'paid_amount' ? value : (latestSnapshot?.paid_amount || 0),
          updated_at: now,
          update_source: updateSource,
        })
        .select()
        .single();

      // If insert fails due to race (another request created the row), retry as update
      if (insertError) {
        const { data: retryUpdate, error: retryError } = await supabase
          .from('financial_snapshots')
          .update({ [field]: value, updated_at: now, update_source: updateSource, updated_by: user!.id })
          .eq('matter_id', matterId)
          .eq('as_of_date', today)
          .select()
          .single();
        if (retryError) throw retryError;
        return { data: retryUpdate, matterId };
      }

      return { data: inserted, matterId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', result.matterId] });
      queryClient.invalidateQueries({ queryKey: ['matter', result.matterId] });
      refreshAllChartAndListCaches();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  const updateSnapshot = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateSnapshotInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('financial_snapshots')
        .update({ ...input, updated_by: user!.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refreshAllChartAndListCaches();
      toast({ title: 'Snapshot updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update snapshot', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      // Delete any write_off_events seeded from this snapshot first. The FK
      // is ON DELETE SET NULL, so without this the write-off amount stays in
      // dashboard / realization / burn calculations even after the snapshot
      // is gone — which is exactly what "deleted data still in graphs" looks
      // like to the user.
      await supabase
        .from('write_off_events' as never)
        .delete()
        .eq('source_snapshot_id', id);

      const { error } = await supabase
        .from('financial_snapshots')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshAllChartAndListCaches();
      toast({ title: 'Snapshot deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete snapshot', description: error.message, variant: 'destructive' });
    },
  });

  return {
    snapshots: snapshotsQuery.data || [],
    isLoading: snapshotsQuery.isLoading,
    error: snapshotsQuery.error,
    createSnapshot,
    updateSnapshot,
    deleteSnapshot,
    upsertTodaySnapshot,
  };
}
