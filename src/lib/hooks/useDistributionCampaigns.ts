import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { ContactFilters } from "./useDistributionContacts";

export interface DistributionCampaign {
  id: string;
  user_id: string;
  name: string;
  saved_filters: ContactFilters;
  created_at: string;
  updated_at: string;
}

export function useDistributionCampaigns() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-campaigns", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DistributionCampaign[];
    },
    enabled: !!user,
  });
}

export function useDistributionCampaign(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-campaign", id],
    queryFn: async () => {
      if (!user || !id) return null;

      const { data, error } = await supabase
        .from("distribution_campaigns")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data as DistributionCampaign;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateDistributionCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: ContactFilters }) => {
      if (!user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase
        .from("distribution_campaigns") as any)
        .insert({
          user_id: user.id,
          name,
          saved_filters: filters,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("distribution_activity_log") as any).insert({
        user_id: user.id,
        activity_type: "campaign_created",
        description: `Created campaign: ${name}`,
        metadata: { campaign_id: data.id, filters },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-activity"] });
      toast.success("Campaign created");
    },
    onError: () => {
      toast.error("Failed to create campaign");
    },
  });
}

export function useUpdateDistributionCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, name, filters }: { id: string; name?: string; filters?: ContactFilters }) => {
      if (!user) throw new Error("Not authenticated");

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (filters !== undefined) updates.saved_filters = filters as unknown as Record<string, unknown>;

      const { data, error } = await supabase
        .from("distribution_campaigns")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-campaign", variables.id] });
      toast.success("Campaign updated");
    },
    onError: () => {
      toast.error("Failed to update campaign");
    },
  });
}

export function useDeleteDistributionCampaign() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("distribution_campaigns")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: () => {
      toast.error("Failed to delete campaign");
    },
  });
}
