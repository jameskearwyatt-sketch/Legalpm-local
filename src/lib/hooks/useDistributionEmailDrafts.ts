import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type EmailDeliveryMode = "individual" | "to_all" | "bcc_all";
export type EmailDraftType = "event_invitation" | "article_sharing" | "firm_update";

export interface DistributionEmailDraft {
  id: string;
  user_id: string;
  campaign_id: string | null;
  draft_type: EmailDraftType;
  delivery_mode: EmailDeliveryMode;
  subject: string;
  body: string;
  recipient_count: number;
  recipient_emails: string[];
  was_sent: boolean;
  sent_date: string | null;
  sent_confirmed_at: string | null;
  created_at: string;
}

const QUERY_KEY = ["distribution-email-drafts"] as const;

export function useDistributionEmailDrafts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: QUERY_KEY,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("distribution_email_drafts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DistributionEmailDraft[];
    },
  });
}

export interface CreateDistributionEmailDraftInput {
  campaign_id: string | null;
  draft_type: EmailDraftType;
  delivery_mode: EmailDeliveryMode;
  subject: string;
  body: string;
  recipient_count: number;
  recipient_emails: string[];
}

export function useCreateDistributionEmailDraft() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDistributionEmailDraftInput) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("distribution_email_drafts")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as DistributionEmailDraft;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Draft saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface UpdateDistributionEmailDraftInput {
  id: string;
  was_sent?: boolean;
  sent_date?: string | null;
  subject?: string;
  body?: string;
}

export function useUpdateDistributionEmailDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateDistributionEmailDraftInput) => {
      const updates: Record<string, unknown> = { ...patch };
      if (patch.was_sent === true) updates.sent_confirmed_at = new Date().toISOString();
      if (patch.was_sent === false) updates.sent_confirmed_at = null;
      const { data, error } = await supabase
        .from("distribution_email_drafts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as DistributionEmailDraft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteDistributionEmailDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("distribution_email_drafts").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Draft deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
