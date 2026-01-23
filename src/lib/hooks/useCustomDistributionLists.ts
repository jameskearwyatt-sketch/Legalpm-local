import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface CustomDistributionList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export interface CustomListContact {
  id: string;
  list_id: string;
  contact_id: string;
  user_id: string;
  added_at: string;
}

export function useCustomDistributionLists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all custom distribution lists with contact counts
  const { data: lists = [], isLoading, refetch } = useQuery({
    queryKey: ["custom-distribution-lists", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: listsData, error: listsError } = await supabase
        .from("custom_distribution_lists")
        .select("*")
        .order("name");

      if (listsError) throw listsError;

      // Get contact counts for each list
      const { data: countsData, error: countsError } = await supabase
        .from("custom_list_contacts")
        .select("list_id");

      if (countsError) throw countsError;

      // Count contacts per list
      const countMap = new Map<string, number>();
      countsData?.forEach((item: { list_id: string }) => {
        countMap.set(item.list_id, (countMap.get(item.list_id) || 0) + 1);
      });

      return (listsData || []).map((list: CustomDistributionList) => ({
        ...list,
        contact_count: countMap.get(list.id) || 0,
      }));
    },
    enabled: !!user?.id,
  });

  // Create a new list
  const createList = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("custom_distribution_lists")
        .insert({
          user_id: user.id,
          name,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-distribution-lists"] });
      toast.success("Distribution list created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create list: ${error.message}`);
    },
  });

  // Delete a list
  const deleteList = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from("custom_distribution_lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-distribution-lists"] });
      queryClient.invalidateQueries({ queryKey: ["custom-list-contacts"] });
      toast.success("Distribution list deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete list: ${error.message}`);
    },
  });

  // Update a list
  const updateList = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string }) => {
      const { error } = await supabase
        .from("custom_distribution_lists")
        .update({ name, description: description || null })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-distribution-lists"] });
      toast.success("Distribution list updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update list: ${error.message}`);
    },
  });

  return {
    lists,
    isLoading,
    refetch,
    createList,
    deleteList,
    updateList,
  };
}

export function useCustomListContacts(listId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch contacts in a specific list
  const { data: contactIds = [], isLoading, refetch } = useQuery({
    queryKey: ["custom-list-contacts", listId],
    queryFn: async () => {
      if (!listId || !user?.id) return [];

      const { data, error } = await supabase
        .from("custom_list_contacts")
        .select("contact_id")
        .eq("list_id", listId);

      if (error) throw error;
      return (data || []).map((item: { contact_id: string }) => item.contact_id);
    },
    enabled: !!listId && !!user?.id,
  });

  // Check which contacts are already in a list - memoized to prevent infinite loops
  const checkExistingContacts = useCallback(async (checkListId: string, checkContactIds: string[]): Promise<{
    existing: string[];
    toAdd: string[];
  }> => {
    if (!user?.id) return { existing: [], toAdd: checkContactIds };

    const { data, error } = await supabase
      .from("custom_list_contacts")
      .select("contact_id")
      .eq("list_id", checkListId)
      .in("contact_id", checkContactIds);

    if (error) throw error;

    const existingSet = new Set((data || []).map((item: { contact_id: string }) => item.contact_id));
    const existing = checkContactIds.filter(id => existingSet.has(id));
    const toAdd = checkContactIds.filter(id => !existingSet.has(id));

    return { existing, toAdd };
  }, [user?.id]);

  // Add contacts to a list
  const addContacts = useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const records = contactIds.map(contactId => ({
        list_id: listId,
        contact_id: contactId,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from("custom_list_contacts")
        .insert(records);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-list-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["custom-distribution-lists"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add contacts: ${error.message}`);
    },
  });

  // Remove contacts from a list
  const removeContacts = useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const { error } = await supabase
        .from("custom_list_contacts")
        .delete()
        .eq("list_id", listId)
        .in("contact_id", contactIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-list-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["custom-distribution-lists"] });
      toast.success("Contacts removed from list");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove contacts: ${error.message}`);
    },
  });

  return {
    contactIds,
    isLoading,
    refetch,
    checkExistingContacts,
    addContacts,
    removeContacts,
  };
}
