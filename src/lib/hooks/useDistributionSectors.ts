import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface DistributionSector {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export function useDistributionSectors() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-sectors", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_sectors")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return data as DistributionSector[];
    },
    enabled: !!user,
  });
}

export function useCreateDistributionSector() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get max sort order
      const { data: existing } = await supabase
        .from("distribution_sectors")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from("distribution_sectors")
        .insert({
          user_id: user.id,
          name,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-sectors"] });
      toast.success("Sector added");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("This sector already exists");
      } else {
        toast.error("Failed to add sector");
      }
    },
  });
}

export function useDeleteDistributionSector() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("distribution_sectors")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-sectors"] });
      toast.success("Sector removed");
    },
    onError: () => {
      toast.error("Failed to remove sector");
    },
  });
}

export function useUpdateSectorOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectors: { id: string; sort_order: number }[]) => {
      if (!user) throw new Error("Not authenticated");

      const updates = sectors.map(s => 
        supabase
          .from("distribution_sectors")
          .update({ sort_order: s.sort_order })
          .eq("id", s.id)
          .eq("user_id", user.id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-sectors"] });
    },
  });
}
