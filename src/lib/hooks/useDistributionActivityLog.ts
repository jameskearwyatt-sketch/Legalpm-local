import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DistributionActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useDistributionActivityLog(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-activity", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_activity_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as DistributionActivityLog[];
    },
    enabled: !!user,
  });
}

export function useLogDistributionActivity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      activity_type, 
      description, 
      metadata 
    }: { 
      activity_type: string; 
      description: string; 
      metadata?: Record<string, unknown>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase
        .from("distribution_activity_log") as any)
        .insert({
          user_id: user.id,
          activity_type,
          description,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-activity"] });
    },
  });
}
