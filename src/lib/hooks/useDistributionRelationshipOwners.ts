import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface DistributionRelationshipOwner {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export function useDistributionRelationshipOwners() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-relationship-owners", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_relationship_owners")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as DistributionRelationshipOwner[];
    },
    enabled: !!user,
  });
}

export function useEnsureRelationshipOwner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!user || !name.trim()) return null;

      const trimmedName = name.trim();

      // Try to insert, ignore if already exists
      const { error } = await supabase
        .from("distribution_relationship_owners")
        .upsert(
          { user_id: user.id, name: trimmedName },
          { onConflict: 'user_id,name', ignoreDuplicates: true }
        );

      if (error && !error.message.includes("duplicate")) {
        throw error;
      }

      return trimmedName;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-relationship-owners"] });
    },
  });
}
