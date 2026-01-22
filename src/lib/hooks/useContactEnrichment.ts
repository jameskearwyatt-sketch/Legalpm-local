import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrichmentResult {
  gender?: 'male' | 'female' | 'unknown';
  company?: string;
  country?: string;
  city?: string;
  job_title?: string;
  sectors?: string[];
  linkedin_url?: string;
  email_status?: string;
  sic_codes?: string[];
  naics_codes?: string[];
  company_keywords?: string[];
  confidence: {
    gender?: number;
    location?: number;
    sector?: number;
  };
  sources: string[];
}

interface EnrichContactParams {
  contactId: string;
  fullName: string;
  email: string;
  linkedinUrl?: string | null;
  company?: string | null;
}

export function useEnrichContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EnrichContactParams): Promise<EnrichmentResult> => {
      const { data, error } = await supabase.functions.invoke('enrich-contact', {
        body: params,
      });

      if (error) {
        throw new Error(error.message || 'Failed to enrich contact');
      }

      if (!data.success) {
        throw new Error(data.error || 'Enrichment failed');
      }

      return data.data;
    },
    onSuccess: async (result, params) => {
      // Update the contact with enriched data
      const updates: Record<string, unknown> = {};
      
      if (result.gender && result.gender !== 'unknown') {
        updates.gender = result.gender;
      }
      if (result.company) {
        updates.company = result.company;
      }
      if (result.country) {
        updates.country = result.country;
      }
      if (result.city) {
        updates.city = result.city;
      }
      if (result.job_title) {
        updates.job_title = result.job_title;
      }
      if (result.sectors && result.sectors.length > 0) {
        updates.sectors = result.sectors;
        updates.sectors_ai_assigned = true;
      }
      if (result.linkedin_url) {
        updates.linkedin_url = result.linkedin_url;
      }
      if (result.email_status) {
        updates.email_status = result.email_status;
      }
      if (result.sic_codes && result.sic_codes.length > 0) {
        updates.sic_codes = result.sic_codes;
      }
      if (result.naics_codes && result.naics_codes.length > 0) {
        updates.naics_codes = result.naics_codes;
      }
      if (result.company_keywords && result.company_keywords.length > 0) {
        updates.company_keywords = result.company_keywords;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('distribution_contacts')
          .update(updates)
          .eq('id', params.contactId);

        if (error) {
          console.error('Failed to update contact:', error);
          toast.error('Enrichment data found but failed to save');
          return;
        }

        // Invalidate queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
        
        const fieldsUpdated = Object.keys(updates).filter(k => k !== 'sectors_ai_assigned');
        toast.success(`Enriched: ${fieldsUpdated.join(', ')}`, {
          description: `Sources: ${result.sources.join(', ')}`,
        });
      } else {
        toast.info('No new data found to enrich');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to enrich contact');
    },
  });
}

export function useBulkEnrichContacts() {
  const enrichContact = useEnrichContact();

  return useMutation({
    mutationFn: async (contacts: EnrichContactParams[]) => {
      const results: { contactId: string; success: boolean; error?: string }[] = [];
      
      // Process in batches of 3 to avoid rate limits
      for (let i = 0; i < contacts.length; i += 3) {
        const batch = contacts.slice(i, i + 3);
        const batchResults = await Promise.allSettled(
          batch.map(contact => enrichContact.mutateAsync(contact))
        );
        
        batchResults.forEach((result, idx) => {
          const contact = batch[idx];
          if (result.status === 'fulfilled') {
            results.push({ contactId: contact.contactId, success: true });
          } else {
            results.push({ 
              contactId: contact.contactId, 
              success: false, 
              error: result.reason?.message 
            });
          }
        });
        
        // Small delay between batches
        if (i + 3 < contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return results;
    },
  });
}
