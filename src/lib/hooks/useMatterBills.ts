import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface MatterBill {
  id: string;
  matter_id: string;
  user_id: string;
  amount: number;
  created_at: string;
}

export function useMatterBills(matterId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const billsQuery = useQuery({
    queryKey: ['matter-bills', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matter_bills')
        .select('*')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as MatterBill[];
    },
    enabled: !!user && !!matterId,
  });

  const addBill = useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await supabase
        .from('matter_bills')
        .insert({
          matter_id: matterId,
          user_id: user!.id,
          amount,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-bills', matterId] });
    },
  });

  const updateBill = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data, error } = await supabase
        .from('matter_bills')
        .update({ amount })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-bills', matterId] });
    },
  });

  const deleteBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matter_bills')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-bills', matterId] });
    },
  });

  const bills = billsQuery.data || [];
  const totalBilled = bills.reduce((sum, bill) => sum + bill.amount, 0);

  return {
    bills,
    totalBilled,
    isLoading: billsQuery.isLoading,
    addBill,
    updateBill,
    deleteBill,
  };
}
