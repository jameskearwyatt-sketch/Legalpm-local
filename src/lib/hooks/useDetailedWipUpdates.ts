import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface DetailedWipUpdateItem {
  id: string;
  wip_update_id: string;
  budget_line_item_id: string;
  work_item: string;
  provider: string;
  category: string | null;
  lc_firm_name: string | null;
  fee_amount: number;
  wip_amount: number;
  write_off_amount: number;
  created_at: string;
}

export interface DetailedWipUpdate {
  id: string;
  matter_id: string;
  user_id: string;
  total_wip_amount: number;
  total_write_off_amount: number;
  updated_at: string;
  created_at: string;
  items?: DetailedWipUpdateItem[];
}

export function useDetailedWipUpdates(matterId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all WIP updates for a matter
  const wipUpdatesQuery = useQuery({
    queryKey: ['detailed-wip-updates', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('detailed_wip_updates')
        .select('*')
        .eq('matter_id', matterId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DetailedWipUpdate[];
    },
    enabled: !!user && !!matterId,
  });

  // Fetch items for a specific WIP update
  const fetchWipUpdateItems = async (wipUpdateId: string): Promise<DetailedWipUpdateItem[]> => {
    const { data, error } = await supabase
      .from('detailed_wip_update_items')
      .select('*')
      .eq('wip_update_id', wipUpdateId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as DetailedWipUpdateItem[];
  };

  // Get the latest WIP update
  const latestWipUpdate = wipUpdatesQuery.data?.[0];

  // Create a new detailed WIP update
  const createWipUpdate = useMutation({
    mutationFn: async ({ 
      matterId, 
      wipItems 
    }: { 
      matterId: string; 
      wipItems: { 
        budget_line_item_id: string; 
        work_item: string;
        provider: string;
        category: string | null;
        lc_firm_name: string | null;
        fee_amount: number;
        wip_amount: number;
        write_off_amount?: number;
      }[] 
    }) => {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const totalWip = wipItems.reduce((sum, item) => sum + item.wip_amount, 0);
      const totalWriteOff = wipItems.reduce((sum, item) => sum + (item.write_off_amount || 0), 0);

      // Create the WIP update record
      const { data: wipUpdate, error: wipUpdateError } = await supabase
        .from('detailed_wip_updates')
        .insert({
          matter_id: matterId,
          user_id: user!.id,
          total_wip_amount: totalWip,
          total_write_off_amount: totalWriteOff,
        })
        .select()
        .single();

      if (wipUpdateError) throw wipUpdateError;

      // Create the WIP update items
      const itemsToInsert = wipItems.map(item => ({
        wip_update_id: wipUpdate.id,
        budget_line_item_id: item.budget_line_item_id,
        work_item: item.work_item,
        provider: item.provider,
        category: item.category,
        lc_firm_name: item.lc_firm_name,
        fee_amount: item.fee_amount,
        wip_amount: item.wip_amount,
        write_off_amount: item.write_off_amount || 0,
      }));

      const { error: itemsError } = await supabase
        .from('detailed_wip_update_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update the budget line items with current WIP and write-offs
      for (const item of wipItems) {
        const { error } = await supabase
          .from('budget_line_items')
          .update({ 
            wip_amount: item.wip_amount,
            wip_write_off: item.write_off_amount || 0,
            wip_updated_at: now
          })
          .eq('id', item.budget_line_item_id);
        
        if (error) throw error;
      }

      // Create or update financial snapshot for today
      const { data: existingSnapshot } = await supabase
        .from('financial_snapshots')
        .select('*')
        .eq('matter_id', matterId)
        .eq('as_of_date', today)
        .maybeSingle();

      if (existingSnapshot) {
        const { error } = await supabase
          .from('financial_snapshots')
          .update({ 
            wip_amount: totalWip,
            wip_write_off_amount: totalWriteOff,
            updated_at: now,
            notes: existingSnapshot.notes 
              ? `${existingSnapshot.notes}\n[Detailed WIP Update]` 
              : '[Detailed WIP Update]'
          })
          .eq('id', existingSnapshot.id);
        
        if (error) throw error;
      } else {
        const { data: latestSnapshot } = await supabase
          .from('financial_snapshots')
          .select('*')
          .eq('matter_id', matterId)
          .order('as_of_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error } = await supabase
          .from('financial_snapshots')
          .insert({
            matter_id: matterId,
            user_id: user!.id,
            as_of_date: today,
            wip_amount: totalWip,
            wip_write_off_amount: totalWriteOff,
            billed_amount: latestSnapshot?.billed_amount || 0,
            paid_amount: latestSnapshot?.paid_amount || 0,
            notes: '[Detailed WIP Update]'
          });
        
        if (error) throw error;
      }

      return wipUpdate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['detailed-wip-updates', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['snapshots', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Budget utilisation update saved successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save WIP update', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a WIP update
  const deleteWipUpdate = useMutation({
    mutationFn: async ({ wipUpdateId, matterId }: { wipUpdateId: string; matterId: string }) => {
      // Get all WIP updates for this matter to determine if this is the latest
      const { data: allUpdates } = await supabase
        .from('detailed_wip_updates')
        .select('*')
        .eq('matter_id', matterId)
        .order('created_at', { ascending: false });

      const isLatest = allUpdates?.[0]?.id === wipUpdateId;

      // Delete the WIP update (items will cascade delete)
      const { error: deleteError } = await supabase
        .from('detailed_wip_updates')
        .delete()
        .eq('id', wipUpdateId);

      if (deleteError) throw deleteError;

      // If we deleted the latest, we need to restore the previous WIP values to budget line items
      if (isLatest && allUpdates && allUpdates.length > 1) {
        const previousUpdate = allUpdates[1];
        
        // Get items from the previous update
        const { data: previousItems } = await supabase
          .from('detailed_wip_update_items')
          .select('*')
          .eq('wip_update_id', previousUpdate.id);

        if (previousItems) {
          for (const item of previousItems) {
            await supabase
              .from('budget_line_items')
              .update({ 
                wip_amount: item.wip_amount,
                wip_write_off: item.write_off_amount || 0,
                wip_updated_at: previousUpdate.created_at
              })
              .eq('id', item.budget_line_item_id);
          }
        }
      } else if (isLatest) {
        // No previous updates, reset WIP to 0 on all line items
        // Get the latest budget version's line items
        const { data: budgetVersions } = await supabase
          .from('budget_versions')
          .select('id')
          .eq('matter_id', matterId)
          .order('version_number', { ascending: false })
          .limit(1);

        if (budgetVersions && budgetVersions.length > 0) {
          await supabase
            .from('budget_line_items')
            .update({ 
              wip_amount: 0,
              wip_write_off: 0,
              wip_updated_at: null
            })
            .eq('budget_version_id', budgetVersions[0].id);
        }
      }

      return wipUpdateId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['detailed-wip-updates', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['budget-line-items'] });
      queryClient.invalidateQueries({ queryKey: ['budget-versions', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['snapshots', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', variables.matterId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'WIP update deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete WIP update', description: error.message, variant: 'destructive' });
    },
  });

  return {
    wipUpdates: wipUpdatesQuery.data || [],
    latestWipUpdate,
    isLoading: wipUpdatesQuery.isLoading,
    error: wipUpdatesQuery.error,
    fetchWipUpdateItems,
    createWipUpdate,
    deleteWipUpdate,
  };
}
