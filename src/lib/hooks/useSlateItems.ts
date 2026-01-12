import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface SlateItem {
  id: string;
  user_id: string;
  title: string;
  is_personal: boolean;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useSlateItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all slate items for the current user
  const { data: slateItems = [], isLoading, refetch } = useQuery({
    queryKey: ['slate-items', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('slate_items')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching slate items:', error);
        throw error;
      }
      
      return data as SlateItem[];
    },
    enabled: !!user,
  });

  // Work slate items (is_personal = false)
  const workSlateItems = slateItems.filter(item => !item.is_personal && !item.is_completed);
  
  // Personal slate items (is_personal = true)
  const personalSlateItems = slateItems.filter(item => item.is_personal && !item.is_completed);

  // Add a new slate item
  const addSlateItem = useMutation({
    mutationFn: async ({ title, isPersonal }: { title: string; isPersonal: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get the max sort_order for the appropriate category
      const relevantItems = isPersonal ? personalSlateItems : workSlateItems;
      const maxSortOrder = relevantItems.length > 0 
        ? Math.max(...relevantItems.map(item => item.sort_order))
        : -1;
      
      const { data, error } = await supabase
        .from('slate_items')
        .insert({
          user_id: user.id,
          title: title.trim(),
          is_personal: isPersonal,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error adding slate item:', error);
      toast.error('Failed to add item');
    },
  });

  // Update a slate item
  const updateSlateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SlateItem> }) => {
      const { data, error } = await supabase
        .from('slate_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error updating slate item:', error);
      toast.error('Failed to update item');
    },
  });

  // Delete a slate item
  const deleteSlateItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('slate_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error deleting slate item:', error);
      toast.error('Failed to delete item');
    },
  });

  // Complete a slate item (with optional notes - though slate items don't have notes, we mark as completed)
  const completeSlateItem = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { data, error } = await supabase
        .from('slate_items')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error completing slate item:', error);
      toast.error('Failed to update item');
    },
  });

  // Reorder slate items (update sort_order for multiple items)
  const reorderSlateItems = useMutation({
    mutationFn: async (items: { id: string; sort_order: number }[]) => {
      // Update all items in parallel
      const updates = items.map(item => 
        supabase
          .from('slate_items')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
      );
      
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error reordering slate items:', error);
      toast.error('Failed to reorder items');
    },
  });

  // Promote a slate item to quick_tasks
  const promoteToQuickTask = useMutation({
    mutationFn: async (slateItem: SlateItem) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create quick task
      const { data: newTask, error: insertError } = await supabase
        .from('quick_tasks')
        .insert({
          title: slateItem.title,
          user_id: user.id,
          on_slate: true,
          is_completed: false,
          is_urgent: false,
          importance: 'unset',
          urgency: 'unset',
          effort: 'unset',
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Delete slate item
      const { error: deleteError } = await supabase
        .from('slate_items')
        .delete()
        .eq('id', slateItem.id);
      
      if (deleteError) throw deleteError;
      
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
      queryClient.invalidateQueries({ queryKey: ['quick-tasks'] });
      toast.success('Added to task list');
    },
    onError: (error) => {
      console.error('Error promoting slate item:', error);
      toast.error('Failed to add to task list');
    },
  });

  return {
    slateItems,
    workSlateItems,
    personalSlateItems,
    isLoading,
    refetch,
    addSlateItem,
    updateSlateItem,
    deleteSlateItem,
    completeSlateItem,
    reorderSlateItems,
    promoteToQuickTask,
  };
}

// Hook to manage slate sort order for quick_tasks and growth_tasks
export function useSlateOrder() {
  const queryClient = useQueryClient();

  // Update slate_sort_order for a quick task
  const updateQuickTaskSlateOrder = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('quick_tasks')
        .update({ slate_sort_order: sortOrder })
        .eq('id', id);
      
      if (error) throw error;
    },
    onError: (error) => {
      console.error('Error updating quick task slate order:', error);
    },
  });

  // Update slate_sort_order for a growth task
  const updateGrowthTaskSlateOrder = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      const { error } = await supabase
        .from('growth_tasks')
        .update({ slate_sort_order: sortOrder })
        .eq('id', id);
      
      if (error) throw error;
    },
    onError: (error) => {
      console.error('Error updating growth task slate order:', error);
    },
  });

  // Batch update slate order for multiple tasks
  const batchUpdateSlateOrder = useMutation({
    mutationFn: async (updates: { id: string; source: 'quick' | 'growth' | 'slate-item'; sortOrder: number }[]) => {
      const quickUpdates = updates.filter(u => u.source === 'quick');
      const growthUpdates = updates.filter(u => u.source === 'growth');
      const slateItemUpdates = updates.filter(u => u.source === 'slate-item');
      
      // Update quick tasks
      for (const update of quickUpdates) {
        const { error } = await supabase
          .from('quick_tasks')
          .update({ slate_sort_order: update.sortOrder })
          .eq('id', update.id);
        if (error) throw error;
      }
      
      // Update growth tasks (remove 'growth-' prefix if present)
      for (const update of growthUpdates) {
        const realId = update.id.startsWith('growth-') ? update.id.replace('growth-', '') : update.id;
        const { error } = await supabase
          .from('growth_tasks')
          .update({ slate_sort_order: update.sortOrder })
          .eq('id', realId);
        if (error) throw error;
      }
      
      // Update slate items
      for (const update of slateItemUpdates) {
        const { error } = await supabase
          .from('slate_items')
          .update({ sort_order: update.sortOrder })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['quick-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-upcoming-growth-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['slate-items'] });
    },
    onError: (error) => {
      console.error('Error batch updating slate order:', error);
    },
  });

  return {
    updateQuickTaskSlateOrder,
    updateGrowthTaskSlateOrder,
    batchUpdateSlateOrder,
  };
}
