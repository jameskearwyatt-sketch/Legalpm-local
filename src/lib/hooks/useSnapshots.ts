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
  billed_amount: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSnapshotInput {
  matter_id: string;
  as_of_date: string;
  wip_amount: number;
  billed_amount: number;
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
  };
}
