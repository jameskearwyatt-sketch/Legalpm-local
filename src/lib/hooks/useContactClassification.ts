import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClassifyContactsParams {
  contactIds?: string[];
  classifyAll?: boolean;
  reclassify?: boolean;
}

interface ClassificationResult {
  id: string;
  is_law_firm: boolean;
  is_consultant: boolean;
  reason: string;
}

interface ClassifyContactsResponse {
  success: boolean;
  classified: number;
  results?: ClassificationResult[];
  message?: string;
  error?: string;
}

export function useClassifyContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactIds, classifyAll, reclassify }: ClassifyContactsParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke<ClassifyContactsResponse>(
        "classify-contacts",
        {
          body: { contactIds, classifyAll, reclassify },
        }
      );

      if (response.error) {
        throw new Error(response.error.message || "Classification failed");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Classification failed");
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data.classified > 0) {
        toast.success(`Classified ${data.classified} contact${data.classified !== 1 ? 's' : ''}`);
      } else {
        toast.info(data.message || "No contacts to classify");
      }
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
    },
    onError: (error: Error) => {
      console.error("Classification error:", error);
      toast.error(error.message || "Failed to classify contacts");
    },
  });
}
