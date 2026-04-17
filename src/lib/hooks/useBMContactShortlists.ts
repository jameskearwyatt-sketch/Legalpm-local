import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const QUERY_KEY = ["bm-contact-shortlists"] as const;

export function useBMContactShortlists() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bm_contact_shortlists")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BMContactShortlist[];
    },
  });
}

export function useCreateBMShortlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("bm_contact_shortlists")
        .insert({ name: input.name, description: input.description ?? null, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as BMContactShortlist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Shortlist created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddToShortlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shortlistId, contactIds }: { shortlistId: string; contactIds: string[] }) => {
      if (!user) throw new Error("Not authenticated");
      if (contactIds.length === 0) return { added: 0 };
      const rows = contactIds.map((contact_id) => ({
        shortlist_id: shortlistId,
        contact_id,
        user_id: user.id,
      }));
      const { error } = await supabase
        .from("bm_shortlist_members")
        .upsert(rows, { onConflict: "shortlist_id,contact_id", ignoreDuplicates: true });
      if (error) throw error;
      return { added: contactIds.length };
    },
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["bm-shortlist-members"] });
      toast.success(`Added ${added} contact${added !== 1 ? "s" : ""} to shortlist`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
