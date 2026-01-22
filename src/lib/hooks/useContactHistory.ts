import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface ContactHistoryEntry {
  id: string;
  contact_id: string;
  user_id: string;
  changed_at: string;
  change_source: 'manual' | 'enrichment' | 'import';
  field_name: string;
  old_value: string | null;
  new_value: string | null;
}

export function useContactHistory(contactId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contact-history", contactId],
    queryFn: async () => {
      if (!user || !contactId) return [];

      const { data, error } = await supabase
        .from("distribution_contact_history")
        .select("*")
        .eq("contact_id", contactId)
        .eq("user_id", user.id)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return data as ContactHistoryEntry[];
    },
    enabled: !!user && !!contactId,
  });
}

export function useLogContactChange() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      contactId,
      fieldName,
      oldValue,
      newValue,
      changeSource = 'manual',
    }: {
      contactId: string;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      changeSource?: 'manual' | 'enrichment' | 'import';
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("distribution_contact_history")
        .insert({
          contact_id: contactId,
          user_id: user.id,
          field_name: fieldName,
          old_value: oldValue,
          new_value: newValue,
          change_source: changeSource,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contact-history", variables.contactId] });
    },
  });
}

export function useBulkLogContactChanges() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      changes: {
        contactId: string;
        fieldName: string;
        oldValue: string | null;
        newValue: string | null;
        changeSource?: 'manual' | 'enrichment' | 'import';
      }[]
    ) => {
      if (!user) throw new Error("Not authenticated");

      const records = changes.map((c) => ({
        contact_id: c.contactId,
        user_id: user.id,
        field_name: c.fieldName,
        old_value: c.oldValue,
        new_value: c.newValue,
        change_source: c.changeSource || 'manual',
      }));

      const { data, error } = await supabase
        .from("distribution_contact_history")
        .insert(records)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-history"] });
    },
  });
}

// Helper to get a readable label for field names
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    job_title: "Job Title",
    company: "Company",
    email: "Email",
    country: "Country",
    city: "City",
    gender: "Gender",
    sectors: "Sectors",
    linkedin_url: "LinkedIn",
    relationship_owner: "Relationship Owner",
    full_name: "Name",
    notes: "Notes",
    do_not_contact: "Do Not Contact",
  };
  return labels[fieldName] || fieldName;
}
