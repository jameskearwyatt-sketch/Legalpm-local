import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface BMContactShortlist {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface BMShortlistMember {
  id: string;
  user_id: string;
  shortlist_id: string;
  contact_id: string;
  added_at: string;
}

export function useBMContactShortlists() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bm-contact-shortlists', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('bm_contact_shortlists')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as BMContactShortlist[];
    },
    enabled: !!user,
  });
}

export function useCreateBMShortlist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: shortlist, error } = await supabase
        .from('bm_contact_shortlists')
        .insert({ ...data, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return shortlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-contact-shortlists'] });
      toast.success('Shortlist created');
    },
    onError: (error) => {
      toast.error('Failed to create shortlist: ' + error.message);
    },
  });
}

export function useUpdateBMShortlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string }) => {
      const { data, error } = await supabase
        .from('bm_contact_shortlists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-contact-shortlists'] });
      toast.success('Shortlist updated');
    },
    onError: (error) => {
      toast.error('Failed to update shortlist: ' + error.message);
    },
  });
}

export function useDeleteBMShortlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bm_contact_shortlists')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-contact-shortlists'] });
      queryClient.invalidateQueries({ queryKey: ['bm-shortlist-members'] });
      toast.success('Shortlist deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete shortlist: ' + error.message);
    },
  });
}

// Shortlist members
export function useBMShortlistMembers(shortlistId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bm-shortlist-members', shortlistId],
    queryFn: async () => {
      if (!user || !shortlistId) return [];

      const { data, error } = await supabase
        .from('bm_shortlist_members')
        .select('*')
        .eq('shortlist_id', shortlistId)
        .eq('user_id', user.id);

      if (error) throw error;
      return data as BMShortlistMember[];
    },
    enabled: !!user && !!shortlistId,
  });
}

export function useContactShortlistMemberships(contactId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bm-contact-memberships', contactId],
    queryFn: async () => {
      if (!user || !contactId) return [];

      const { data, error } = await supabase
        .from('bm_shortlist_members')
        .select('shortlist_id')
        .eq('contact_id', contactId)
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(d => d.shortlist_id);
    },
    enabled: !!user && !!contactId,
  });
}

export function useAddToShortlist() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ shortlistId, contactIds }: { shortlistId: string; contactIds: string[] }) => {
      if (!user) throw new Error('Not authenticated');

      const members = contactIds.map(contactId => ({
        shortlist_id: shortlistId,
        contact_id: contactId,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('bm_shortlist_members')
        .upsert(members, { onConflict: 'shortlist_id,contact_id' });

      if (error) throw error;
    },
    onSuccess: (_, { contactIds }) => {
      queryClient.invalidateQueries({ queryKey: ['bm-shortlist-members'] });
      queryClient.invalidateQueries({ queryKey: ['bm-contact-memberships'] });
      toast.success(`Added ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} to shortlist`);
    },
    onError: (error) => {
      toast.error('Failed to add to shortlist: ' + error.message);
    },
  });
}

export function useRemoveFromShortlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shortlistId, contactIds }: { shortlistId: string; contactIds: string[] }) => {
      const { error } = await supabase
        .from('bm_shortlist_members')
        .delete()
        .eq('shortlist_id', shortlistId)
        .in('contact_id', contactIds);

      if (error) throw error;
    },
    onSuccess: (_, { contactIds }) => {
      queryClient.invalidateQueries({ queryKey: ['bm-shortlist-members'] });
      queryClient.invalidateQueries({ queryKey: ['bm-contact-memberships'] });
      toast.success(`Removed ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} from shortlist`);
    },
    onError: (error) => {
      toast.error('Failed to remove from shortlist: ' + error.message);
    },
  });
}
