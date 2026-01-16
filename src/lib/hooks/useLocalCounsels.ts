import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface LocalCounsel {
  id: string;
  matter_id: string;
  user_id: string;
  firm_name: string;
  allocated_budget: number;
  wip_amount: number;
  billed_amount: number;
  billing_mode: 'Direct' | 'Disb' | null;
  last_updated: string | null;
  update_source: 'manual' | 'bulk' | null;
  wip_updated_at: string | null;
  billed_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLocalCounselInput {
  matter_id: string;
  firm_name: string;
  allocated_budget?: number;
}

export interface UpdateLocalCounselInput {
  id: string;
  wip_amount?: number;
  billed_amount?: number;
  billing_mode?: 'Direct' | 'Disb' | null;
  last_updated?: string | null;
  allocated_budget?: number;
  update_source?: 'manual' | 'bulk' | null;
  wip_updated_at?: string | null;
  billed_updated_at?: string | null;
}

export interface UpsertLocalCounselInput {
  matter_id: string;
  firm_name: string;
  allocated_budget: number;
}

export function useLocalCounsels(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all local counsels for a matter
  const localCounselsQuery = useQuery({
    queryKey: ['local-counsels', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matter_local_counsels')
        .select('*')
        .eq('matter_id', matterId!)
        .order('firm_name', { ascending: true });

      if (error) throw error;
      return data as LocalCounsel[];
    },
    enabled: !!user && !!matterId,
  });

  // Create a new local counsel
  const createLocalCounsel = useMutation({
    mutationFn: async (input: CreateLocalCounselInput) => {
      const { data, error } = await supabase
        .from('matter_local_counsels')
        .insert({
          matter_id: input.matter_id,
          user_id: user!.id,
          firm_name: input.firm_name,
          allocated_budget: input.allocated_budget || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsels', matterId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add local counsel: ${error.message}`);
    },
  });

  // Update a local counsel's financial data
  const updateLocalCounsel = useMutation({
    mutationFn: async (input: UpdateLocalCounselInput) => {
      const updateData: Record<string, unknown> = {};
      if (input.wip_amount !== undefined) updateData.wip_amount = input.wip_amount;
      if (input.billed_amount !== undefined) updateData.billed_amount = input.billed_amount;
      if (input.billing_mode !== undefined) updateData.billing_mode = input.billing_mode;
      if (input.last_updated !== undefined) updateData.last_updated = input.last_updated;
      if (input.allocated_budget !== undefined) updateData.allocated_budget = input.allocated_budget;
      if (input.update_source !== undefined) updateData.update_source = input.update_source;
      if (input.wip_updated_at !== undefined) updateData.wip_updated_at = input.wip_updated_at;
      if (input.billed_updated_at !== undefined) updateData.billed_updated_at = input.billed_updated_at;

      const { data, error } = await supabase
        .from('matter_local_counsels')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsels', matterId] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update local counsel: ${error.message}`);
    },
  });

  // Upsert local counsel (create if doesn't exist, update allocated_budget if exists)
  const upsertLocalCounsel = useMutation({
    mutationFn: async (input: UpsertLocalCounselInput) => {
      const { data, error } = await supabase
        .from('matter_local_counsels')
        .upsert(
          {
            matter_id: input.matter_id,
            user_id: user!.id,
            firm_name: input.firm_name,
            allocated_budget: input.allocated_budget,
          },
          { 
            onConflict: 'matter_id,firm_name',
            ignoreDuplicates: false 
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsels', matterId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to upsert local counsel: ${error.message}`);
    },
  });

  // Batch upsert local counsels from budget line items
  const syncLocalCounselsFromBudget = useMutation({
    mutationFn: async (lineItems: Array<{ firm_name: string; fee_amount: number }>) => {
      if (!matterId || !user) throw new Error('Missing matter ID or user');

      // Group by firm name and sum up allocated budgets
      const firmBudgets = lineItems.reduce((acc, item) => {
        if (!item.firm_name) return acc;
        acc[item.firm_name] = (acc[item.firm_name] || 0) + item.fee_amount;
        return acc;
      }, {} as Record<string, number>);

      // Upsert each firm
      const results = await Promise.all(
        Object.entries(firmBudgets).map(async ([firmName, budget]) => {
          const { data, error } = await supabase
            .from('matter_local_counsels')
            .upsert(
              {
                matter_id: matterId,
                user_id: user.id,
                firm_name: firmName,
                allocated_budget: budget,
              },
              { 
                onConflict: 'matter_id,firm_name',
                ignoreDuplicates: false 
              }
            )
            .select()
            .single();

          if (error) throw error;
          return data;
        })
      );

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsels', matterId] });
    },
    onError: (error: Error) => {
      console.error('Failed to sync local counsels:', error);
    },
  });

  // Delete a local counsel
  const deleteLocalCounsel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matter_local_counsels')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-counsels', matterId] });
      toast.success('Local counsel removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove local counsel: ${error.message}`);
    },
  });

  // Calculate aggregates
  const localCounsels = localCounselsQuery.data || [];
  const totalAllocatedBudget = localCounsels.reduce((sum, lc) => sum + (lc.allocated_budget || 0), 0);
  const totalWip = localCounsels.reduce((sum, lc) => sum + (lc.wip_amount || 0), 0);
  const totalBilled = localCounsels.reduce((sum, lc) => sum + (lc.billed_amount || 0), 0);
  const totalBurn = totalWip + totalBilled;

  return {
    localCounsels,
    isLoading: localCounselsQuery.isLoading,
    error: localCounselsQuery.error,
    createLocalCounsel,
    updateLocalCounsel,
    upsertLocalCounsel,
    syncLocalCounselsFromBudget,
    deleteLocalCounsel,
    // Aggregates
    totalAllocatedBudget,
    totalWip,
    totalBilled,
    totalBurn,
    refetch: localCounselsQuery.refetch,
  };
}
