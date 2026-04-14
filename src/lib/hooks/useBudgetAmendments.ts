import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface BudgetAmendment {
  id: string;
  matter_id: string;
  user_id: string;
  amendment_date: string;
  previous_budget: number;
  new_budget: number;
  previous_bm_fee: number;
  new_bm_fee: number;
  previous_local_counsel: number;
  new_local_counsel: number;
  notes: string | null;
  created_at: string;
}

export interface CreateBudgetAmendmentInput {
  matter_id: string;
  previous_budget: number;
  new_budget: number;
  previous_bm_fee: number;
  new_bm_fee: number;
  previous_local_counsel: number;
  new_local_counsel: number;
  notes?: string;
}

export function useBudgetAmendments(matterId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const amendmentsQuery = useQuery({
    queryKey: ['budget-amendments', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_amendments')
        .select('*')
        .eq('matter_id', matterId!)
        .order('amendment_date', { ascending: false });

      if (error) throw error;
      return data as BudgetAmendment[];
    },
    enabled: !!user && !!matterId,
  });

  const createAmendment = useMutation({
    mutationFn: async (input: CreateBudgetAmendmentInput) => {
      const { data, error } = await supabase
        .from('budget_amendments')
        .insert({
          ...input,
          user_id: user!.id,
          created_by: user!.id,
          amendment_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-amendments'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      toast({ title: 'Budget updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update budget', description: error.message, variant: 'destructive' });
    },
  });

  return {
    amendments: amendmentsQuery.data || [],
    isLoading: amendmentsQuery.isLoading,
    error: amendmentsQuery.error,
    createAmendment,
  };
}
