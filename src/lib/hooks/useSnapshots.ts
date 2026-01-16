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
  });

  const createSnapshot = useMutation({
    mutationFn: async (input: CreateSnapshotInput) => {
      const { data, error } = await supabase
        .from('financial_snapshots')
        .insert({
          ...input,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      
      // Check if a snapshot exists for today
      const { data: existing } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('matter_id', matterId)
        .eq('as_of_date', today)
        .maybeSingle();

      if (existing) {
        // Update existing snapshot - explicitly set updated_at to now
        const { data, error } = await supabase
          .from('financial_snapshots')
          .update({ [field]: value, updated_at: now, update_source: updateSource })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return { data, matterId };
      } else {
        // Get the latest snapshot to copy other values
        const { data: latestSnapshot } = await supabase
          .from('financial_snapshots')
          .select('*')
          .eq('matter_id', matterId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Create new snapshot with today's date
        const { data, error } = await supabase
          .from('financial_snapshots')
          .insert({
            matter_id: matterId,
            user_id: user!.id,
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
        if (error) throw error;
        return { data, matterId };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['snapshots', result.matterId] });
      queryClient.invalidateQueries({ queryKey: ['matter', result.matterId] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });

  const updateSnapshot = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateSnapshotInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('financial_snapshots')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Snapshot updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update snapshot', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('financial_snapshots')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
