import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface MatterClient {
  id: string;
  matter_id: string;
  client_id: string;
  user_id: string;
  cm_number: string | null;
  is_master: boolean;
  fee_percentage: number;
  created_at: string;
  updated_at: string;
  // Joined data
  clients?: {
    id: string;
    name: string;
    display_name?: string | null;
  };
}

export interface CreateMatterClientInput {
  matter_id: string;
  client_id: string;
  cm_number?: string | null;
  is_master: boolean;
  fee_percentage: number;
}

export interface UpdateMatterClientInput {
  id: string;
  cm_number?: string | null;
  is_master?: boolean;
  fee_percentage?: number;
}

export function useMatterClients(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: matterClients = [], isLoading, error } = useQuery({
    queryKey: ['matter-clients', matterId],
    queryFn: async () => {
      if (!matterId) return [];
      
      const { data, error } = await supabase
        .from('matter_clients')
        .select(`
          *,
          clients (id, name, display_name)
        `)
        .eq('matter_id', matterId)
        .order('is_master', { ascending: false })
        .order('fee_percentage', { ascending: false });

      if (error) throw error;
      return data as MatterClient[];
    },
    enabled: !!user && !!matterId,
  });

  const createMatterClient = useMutation({
    mutationFn: async (input: CreateMatterClientInput) => {
      const { data, error } = await supabase
        .from('matter_clients')
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
      queryClient.invalidateQueries({ queryKey: ['matter-clients', matterId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to add client: ' + error.message);
    },
  });

  const updateMatterClient = useMutation({
    mutationFn: async (input: UpdateMatterClientInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('matter_clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-clients', matterId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to update client: ' + error.message);
    },
  });

  const deleteMatterClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('matter_clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-clients', matterId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to remove client: ' + error.message);
    },
  });

  // Batch update all matter clients at once (useful for form submission)
  const saveMatterClients = useMutation({
    mutationFn: async ({ matterId, clients }: { matterId: string; clients: CreateMatterClientInput[] }) => {
      // Delete existing matter clients
      const { error: deleteError } = await supabase
        .from('matter_clients')
        .delete()
        .eq('matter_id', matterId);

      if (deleteError) throw deleteError;

      // Insert new ones if any
      if (clients.length > 0) {
        const { error: insertError } = await supabase
          .from('matter_clients')
          .insert(
            clients.map(c => ({
              ...c,
              matter_id: matterId,
              user_id: user!.id,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matter-clients', matterId] });
    },
    onError: (error: Error) => {
      toast.error('Failed to save clients: ' + error.message);
    },
  });

  return {
    matterClients,
    isLoading,
    error,
    createMatterClient,
    updateMatterClient,
    deleteMatterClient,
    saveMatterClients,
  };
}
