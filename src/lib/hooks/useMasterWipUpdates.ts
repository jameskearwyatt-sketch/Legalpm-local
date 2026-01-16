import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface MasterWipSnapshotChange {
  id: string;
  wip_update_id: string;
  matter_id: string;
  snapshot_id: string | null;
  was_new_snapshot: boolean;
  before_wip_amount: number;
  before_billed_amount: number;
  before_paid_amount: number;
  before_accounts_receivable: number;
  before_wip_write_off_amount: number;
  created_at: string;
}

export interface MasterWipUpdate {
  id: string;
  created_at: string;
  updated_at: string;
  matter_count?: number;
  changes?: MasterWipSnapshotChange[];
}

export function useMasterWipUpdates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all master WIP updates (distinct dates/sessions)
  const masterUpdatesQuery = useQuery({
    queryKey: ['master-wip-updates'],
    queryFn: async () => {
      // Get unique WIP updates that have snapshot changes associated
      const { data, error } = await supabase
        .from('detailed_wip_updates')
        .select(`
          id,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get counts for each update
      const updatesWithCounts = await Promise.all(
        (data || []).map(async (update) => {
          const { count } = await supabase
            .from('master_wip_snapshot_changes')
            .select('*', { count: 'exact', head: true })
            .eq('wip_update_id', update.id);

          return {
            ...update,
            matter_count: count || 0,
          };
        })
      );

      // Only return updates that have associated snapshot changes
      return updatesWithCounts.filter(u => u.matter_count > 0) as MasterWipUpdate[];
    },
    enabled: !!user,
  });

  // Fetch the last master update's changes (for highlighting)
  const lastMasterChangesQuery = useQuery({
    queryKey: ['last-master-wip-changes'],
    queryFn: async () => {
      // First get the most recent master update that has changes
      const { data: latestUpdate, error: updateError } = await supabase
        .from('detailed_wip_updates')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (updateError) throw updateError;
      if (!latestUpdate) return { changes: [], updateDate: null };

      // Check if this update has any snapshot changes
      const { data: changes, error: changesError } = await supabase
        .from('master_wip_snapshot_changes')
        .select('*')
        .eq('wip_update_id', latestUpdate.id);

      if (changesError) throw changesError;

      // If no changes, return empty
      if (!changes || changes.length === 0) {
        return { changes: [], updateDate: null };
      }

      return {
        changes: changes as MasterWipSnapshotChange[],
        updateDate: latestUpdate.created_at,
      };
    },
    enabled: !!user,
  });

  // Fetch changes for a specific master WIP update
  const fetchChangesForUpdate = async (wipUpdateId: string): Promise<MasterWipSnapshotChange[]> => {
    const { data, error } = await supabase
      .from('master_wip_snapshot_changes')
      .select('*')
      .eq('wip_update_id', wipUpdateId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as MasterWipSnapshotChange[];
  };

  // Create a master WIP update record and track all snapshot changes
  const createMasterUpdate = useMutation({
    mutationFn: async ({
      updates,
      lcChanges,
    }: {
      updates: Array<{
        matter_id: string;
        snapshot_id: string | null;
        was_new_snapshot: boolean;
        before_wip_amount: number;
        before_billed_amount: number;
        before_paid_amount: number;
        before_accounts_receivable: number;
        before_wip_write_off_amount: number;
      }>;
      lcChanges?: Array<{
        matter_id: string;
        local_counsel_id: string;
        before_wip_amount: number;
        before_billed_amount: number;
      }>;
    }) => {
      // Create a new detailed_wip_updates record to group these changes
      const { data: wipUpdate, error: wipError } = await supabase
        .from('detailed_wip_updates')
        .insert({
          matter_id: updates[0].matter_id, // Use first matter as reference
          user_id: user!.id,
          total_wip_amount: 0,
          total_write_off_amount: 0,
        })
        .select()
        .single();

      if (wipError) throw wipError;

      // Insert all snapshot changes
      const changes = updates.map((u) => ({
        wip_update_id: wipUpdate.id,
        matter_id: u.matter_id,
        snapshot_id: u.snapshot_id,
        was_new_snapshot: u.was_new_snapshot,
        before_wip_amount: u.before_wip_amount,
        before_billed_amount: u.before_billed_amount,
        before_paid_amount: u.before_paid_amount,
        before_accounts_receivable: u.before_accounts_receivable,
        before_wip_write_off_amount: u.before_wip_write_off_amount,
      }));

      const { error: changesError } = await supabase
        .from('master_wip_snapshot_changes')
        .insert(changes);

      if (changesError) throw changesError;

      // Insert local counsel changes if provided
      if (lcChanges && lcChanges.length > 0) {
        const lcChangeRecords = lcChanges.map((lc) => ({
          wip_update_id: wipUpdate.id,
          matter_id: lc.matter_id,
          local_counsel_id: lc.local_counsel_id,
          before_wip_amount: lc.before_wip_amount,
          before_billed_amount: lc.before_billed_amount,
        }));

        const { error: lcError } = await supabase
          .from('master_lc_changes')
          .insert(lcChangeRecords);

        if (lcError) {
          console.error('Failed to save LC change tracking:', lcError);
          // Don't throw - snapshot changes were still saved
        }
      }

      return wipUpdate.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-wip-updates'] });
      queryClient.invalidateQueries({ queryKey: ['last-master-wip-changes'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create master WIP update record:', error);
    },
  });

  // Revert a master WIP update
  const revertMasterUpdate = useMutation({
    mutationFn: async (wipUpdateId: string) => {
      // Get all snapshot changes for this update
      const { data: changes, error: fetchError } = await supabase
        .from('master_wip_snapshot_changes')
        .select('*')
        .eq('wip_update_id', wipUpdateId);

      if (fetchError) throw fetchError;
      if (!changes || changes.length === 0) {
        throw new Error('No changes found for this update');
      }

      // Get all local counsel changes for this update
      const { data: lcChanges, error: lcFetchError } = await supabase
        .from('master_lc_changes')
        .select('*')
        .eq('wip_update_id', wipUpdateId);

      if (lcFetchError) {
        console.error('Failed to fetch LC changes:', lcFetchError);
        // Continue anyway - we'll still revert the snapshot changes
      }

      // Process each snapshot change
      for (const change of changes) {
        if (change.was_new_snapshot && change.snapshot_id) {
          // This was a new snapshot - delete it entirely
          await supabase
            .from('financial_snapshots')
            .delete()
            .eq('id', change.snapshot_id);
        } else if (change.snapshot_id) {
          // This was an update to existing snapshot - restore previous values
          await supabase
            .from('financial_snapshots')
            .update({
              wip_amount: change.before_wip_amount,
              billed_amount: change.before_billed_amount,
              paid_amount: change.before_paid_amount,
              accounts_receivable: change.before_accounts_receivable,
              wip_write_off_amount: change.before_wip_write_off_amount,
            })
            .eq('id', change.snapshot_id);
        }
      }

      // Revert local counsel changes
      if (lcChanges && lcChanges.length > 0) {
        for (const lcChange of lcChanges) {
          const { error: lcRevertError } = await supabase
            .from('matter_local_counsels')
            .update({
              wip_amount: lcChange.before_wip_amount,
              billed_amount: lcChange.before_billed_amount,
              update_source: 'reverted',
              last_updated: new Date().toISOString(),
            })
            .eq('id', lcChange.local_counsel_id);

          if (lcRevertError) {
            console.error('Failed to revert LC change:', lcRevertError);
          }
        }
      }

      // Delete the master WIP update record (cascade deletes the changes including LC changes)
      const { error: deleteError } = await supabase
        .from('detailed_wip_updates')
        .delete()
        .eq('id', wipUpdateId);

      if (deleteError) throw deleteError;

      return { wipUpdateId, lcRevertedCount: lcChanges?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['master-wip-updates'] });
      queryClient.invalidateQueries({ queryKey: ['last-master-wip-changes'] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['local-counsels'] });
      const lcMsg = result.lcRevertedCount > 0 ? ` (including ${result.lcRevertedCount} local counsel update${result.lcRevertedCount > 1 ? 's' : ''})` : '';
      toast({ title: `Master update reverted successfully${lcMsg}` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to revert update', description: error.message, variant: 'destructive' });
    },
  });

  return {
    masterUpdates: masterUpdatesQuery.data || [],
    isLoading: masterUpdatesQuery.isLoading,
    error: masterUpdatesQuery.error,
    lastMasterChanges: lastMasterChangesQuery.data?.changes || [],
    lastMasterUpdateDate: lastMasterChangesQuery.data?.updateDate || null,
    isLoadingLastChanges: lastMasterChangesQuery.isLoading,
    fetchChangesForUpdate,
    createMasterUpdate,
    revertMasterUpdate,
    refetch: masterUpdatesQuery.refetch,
  };
}
