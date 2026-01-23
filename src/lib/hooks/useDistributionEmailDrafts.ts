import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface DistributionEmailDraft {
  id: string;
  user_id: string;
  campaign_id: string | null;
  draft_type: 'event_invitation' | 'article_sharing' | 'firm_update';
  delivery_mode: 'bcc_all' | 'individual';
  subject: string;
  body: string;
  recipient_count: number;
  recipient_emails: string[];
  created_at: string;
  was_sent: boolean;
  sent_date: string | null;
  sent_confirmed_at: string | null;
}

export function useDistributionEmailDrafts(campaignId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-email-drafts", user?.id, campaignId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("distribution_email_drafts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DistributionEmailDraft[];
    },
    enabled: !!user,
  });
}

export function useCreateDistributionEmailDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (draft: Omit<DistributionEmailDraft, 'id' | 'user_id' | 'created_at' | 'was_sent' | 'sent_date' | 'sent_confirmed_at'>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("distribution_email_drafts")
        .insert({
          ...draft,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from("distribution_activity_log").insert({
        user_id: user.id,
        activity_type: "email_draft_created",
        description: `Created ${draft.draft_type.replace('_', ' ')} draft for ${draft.recipient_count} recipients`,
        metadata: { 
          draft_id: data.id, 
          campaign_id: draft.campaign_id,
          delivery_mode: draft.delivery_mode,
          recipient_count: draft.recipient_count,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-email-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-activity"] });
      toast.success("Email draft created");
    },
    onError: () => {
      toast.error("Failed to create email draft");
    },
  });
}

export function useUpdateDistributionEmailDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, was_sent, sent_date }: { id: string; was_sent: boolean; sent_date: string | null }) => {
      if (!user) throw new Error("Not authenticated");

      const updates: Record<string, unknown> = {
        was_sent,
        sent_date,
        sent_confirmed_at: was_sent ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("distribution_email_drafts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      // Log activity if marking as sent
      if (was_sent) {
        await supabase.from("distribution_activity_log").insert({
          user_id: user.id,
          activity_type: "email_sent_confirmed",
          description: `Confirmed email was sent on ${sent_date}`,
          metadata: { draft_id: id, sent_date },
        });
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-email-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-activity"] });
      if (variables.was_sent) {
        toast.success("Email marked as sent");
      }
    },
    onError: () => {
      toast.error("Failed to update email");
    },
  });
}

export function useDeleteDistributionEmailDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("distribution_email_drafts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-email-drafts"] });
      toast.success("Draft deleted");
    },
    onError: () => {
      toast.error("Failed to delete draft");
    },
  });
}
