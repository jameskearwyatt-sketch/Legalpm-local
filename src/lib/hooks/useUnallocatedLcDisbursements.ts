import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface UnallocatedLcDisbursement {
  id: string;
  matter_id: string;
  user_id: string;
  wip_amount: number;
  ar_amount: number;
  paid_amount: number;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  allocated_at: string | null;
}

export function useUnallocatedLcDisbursements(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: unallocated = [], isLoading } = useQuery({
    queryKey: ['unallocated-lc-disbursements', matterId],
    queryFn: async () => {
      if (!matterId || !user?.id) return [];
      const { data, error } = await supabase
        .from('unallocated_lc_disbursements' as any)
        .select('*')
        .eq('matter_id', matterId)
        .eq('user_id', user.id)
        .is('allocated_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UnallocatedLcDisbursement[];
    },
    enabled: !!matterId && !!user?.id,
  });

  const totalUnallocatedWip = unallocated.reduce((sum, d) => sum + Number(d.wip_amount || 0), 0);
  const totalUnallocatedAr = unallocated.reduce((sum, d) => sum + Number(d.ar_amount || 0), 0);
  const totalUnallocatedPaid = unallocated.reduce((sum, d) => sum + Number(d.paid_amount || 0), 0);

  const createUnallocated = useMutation({
    mutationFn: async (input: {
      matter_id: string;
      wip_amount: number;
      ar_amount: number;
      paid_amount: number;
      source?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('unallocated_lc_disbursements' as any)
        .insert({
          matter_id: input.matter_id,
          user_id: user.id,
          wip_amount: input.wip_amount,
          ar_amount: input.ar_amount,
          paid_amount: input.paid_amount,
          source: input.source || 'master_update',
          notes: input.notes || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unallocated-lc-disbursements'] });
    },
  });

  const markAllocated = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('unallocated_lc_disbursements' as any)
        .update({ allocated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unallocated-lc-disbursements'] });
    },
  });

  const deleteUnallocated = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('unallocated_lc_disbursements' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unallocated-lc-disbursements'] });
    },
  });

  return {
    unallocated,
    isLoading,
    totalUnallocatedWip,
    totalUnallocatedAr,
    totalUnallocatedPaid,
    createUnallocated,
    markAllocated,
    deleteUnallocated,
  };
}
