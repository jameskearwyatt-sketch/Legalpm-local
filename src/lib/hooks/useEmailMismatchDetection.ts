import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function useDetectEmailMismatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ contactIds, runAll }: { contactIds?: string[]; runAll?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('detect-email-mismatch', {
        body: { contactIds, runAll }
      });

      if (error) throw error;
      return data as { checked: number; mismatches: number; updated: number; details: { id: string; mismatch: boolean; reason: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
      if (data.mismatches > 0) {
        toast.warning(`Found ${data.mismatches} email-company mismatch${data.mismatches !== 1 ? 'es' : ''}`);
      } else {
        toast.success(`Checked ${data.checked} contacts - no mismatches found`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to detect mismatches: ${error.message}`);
    }
  });
}

export function useDismissEmailMismatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('distribution_contacts')
        .update({ email_mismatch_dismissed: true, email_company_mismatch: false })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss: ${error.message}`);
    }
  });
}
