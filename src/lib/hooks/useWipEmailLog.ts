import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface WipEmailLogEntry {
  id: string;
  user_id: string;
  matter_id: string;
  client_id: string;
  recipient_emails: string[];
  recipient_names: string[];
  subject: string;
  body: string;
  review_period_start: string;
  review_period_end: string;
  welcome_template_id: string | null;
  was_sent: boolean;
  sent_date: string | null;
  sent_confirmed_at: string | null;
  created_at: string;
}

export function useWipEmailLog(matterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const logQuery = useQuery({
    queryKey: ["wip-email-log", user?.id, matterId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("wip_email_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (matterId) {
        query = query.eq("matter_id", matterId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as WipEmailLogEntry[];
    },
    enabled: !!user,
  });

  const createLogEntry = useMutation({
    mutationFn: async (entry: Omit<WipEmailLogEntry, "id" | "user_id" | "created_at" | "was_sent" | "sent_date" | "sent_confirmed_at">) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("wip_email_log")
        .insert({
          ...entry,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-log"] });
    },
    onError: () => {
      toast.error("Failed to log email");
    },
  });

  const confirmSent = useMutation({
    mutationFn: async ({ id, sentDate }: { id: string; sentDate: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("wip_email_log")
        .update({
          was_sent: true,
          sent_date: sentDate,
          sent_confirmed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-log"] });
      toast.success("Email marked as sent");
    },
    onError: () => {
      toast.error("Failed to update email status");
    },
  });

  const deleteLogEntry = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("wip_email_log")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-log"] });
      toast.success("Log entry deleted");
    },
    onError: () => {
      toast.error("Failed to delete log entry");
    },
  });

  // Get the last confirmed sent email for a specific matter
  const getLastSentForMatter = (mId: string): WipEmailLogEntry | undefined => {
    return logQuery.data?.find(
      (entry) => entry.matter_id === mId && entry.was_sent
    );
  };

  return {
    log: logQuery.data || [],
    isLoading: logQuery.isLoading,
    createLogEntry,
    confirmSent,
    deleteLogEntry,
    getLastSentForMatter,
  };
}
