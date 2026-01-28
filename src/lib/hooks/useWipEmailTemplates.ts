import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface WipEmailTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useWipEmailTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["wip-email-templates", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("wip_email_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw error;
      return data as WipEmailTemplate[];
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: { name: string; content: string; is_default?: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      // If setting as default, unset other defaults first
      if (template.is_default) {
        await supabase
          .from("wip_email_templates")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("wip_email_templates")
        .insert({
          ...template,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-templates"] });
      toast.success("Template saved");
    },
    onError: () => {
      toast.error("Failed to save template");
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WipEmailTemplate> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");

      // If setting as default, unset other defaults first
      if (updates.is_default) {
        await supabase
          .from("wip_email_templates")
          .update({ is_default: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("wip_email_templates")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-templates"] });
      toast.success("Template updated");
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("wip_email_templates")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wip-email-templates"] });
      toast.success("Template deleted");
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    defaultTemplate: templatesQuery.data?.find(t => t.is_default),
  };
}
