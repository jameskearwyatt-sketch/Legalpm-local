import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AnalysisResult {
  proposedFocusAreas: string[];
  focusAreaDescriptions: Record<string, string>;
  analysisDetails: string;
}

export function useAnalyzeFocusAreas() {
  return useMutation({
    mutationFn: async (contactIds?: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('analyze-focus-areas', {
        body: { contactIds },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Analysis failed');
      
      return data as { success: boolean; data: AnalysisResult; focusAreaDescriptions: Record<string, string> };
    },
    onError: (error: Error) => {
      toast.error(`Analysis failed: ${error.message}`);
    },
  });
}

export function useAssignFocusAreas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, focusAreas, protectManualEdits = true }: { contactIds: string[]; focusAreas: string[]; protectManualEdits?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('assign-focus-areas', {
        body: { contactIds, focusAreas, protectManualEdits },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Assignment failed');
      
      return data as { success: boolean; updated: number; errors: number; skipped?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      const message = data.skipped && data.skipped > 0
        ? `Assigned focus areas to ${data.updated} contacts (${data.skipped} protected)`
        : `Assigned focus areas to ${data.updated} contacts`;
      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error(`Assignment failed: ${error.message}`);
    },
  });
}
