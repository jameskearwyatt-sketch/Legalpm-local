import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Invoice {
  id: string;
  matter_id: string;
  user_id: string;
  invoice_number: string;
  invoice_date: string;
  billed_amount: number;
  due_date: string | null;
  status: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue';
  paid_amount: number;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceInput {
  matter_id: string;
  invoice_number: string;
  invoice_date: string;
  billed_amount: number;
  due_date?: string;
  status?: 'Draft' | 'Sent' | 'Part Paid' | 'Paid' | 'Overdue';
  paid_amount?: number;
  paid_date?: string;
  notes?: string;
}

export function useInvoices(matterId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', matterId],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (matterId) {
        query = query.eq('matter_id', matterId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });

  const createInvoice = useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const { data, error } = await supabase
        .from('invoices')
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
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Invoice created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create invoice', description: error.message, variant: 'destructive' });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateInvoiceInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update({ ...input, updated_by: user!.id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Invoice updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update invoice', description: error.message, variant: 'destructive' });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Invoice deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete invoice', description: error.message, variant: 'destructive' });
    },
  });

  return {
    invoices: invoicesQuery.data || [],
    isLoading: invoicesQuery.isLoading,
    error: invoicesQuery.error,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  };
}
