import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { getPrimaryNaicsSector } from "@/lib/naicsUtils";

export interface DistributionContact {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  gender: 'male' | 'female' | 'unknown';
  sectors: string[];
  sectors_ai_assigned: boolean;
  linkedin_url: string | null;
  notes: string | null;
  relationship_owner: string | null;
  do_not_contact: boolean;
  provenance: string | null;
  created_at: string;
  updated_at: string;
  last_enriched_at: string | null;
  // Apollo enrichment fields
  email_status: string | null;
  sic_codes: string[] | null;
  naics_codes: string[] | null;
  company_keywords: string[] | null;
  // EMI Focus Areas
  emi_focus_areas: string[];
  emi_focus_areas_assigned_at: string | null;
  emi_focus_areas_manual_edit: boolean;
  // Email-company mismatch tracking
  email_company_mismatch: boolean;
  email_mismatch_dismissed: boolean;
  // AI classification
  is_law_firm: boolean | null;
  is_consultant: boolean | null;
  classification_reason: string | null;
  classified_at: string | null;
}

export type DistributionContactInsert = Omit<DistributionContact, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_enriched_at' | 'email_status' | 'sic_codes' | 'naics_codes' | 'company_keywords' | 'emi_focus_areas' | 'emi_focus_areas_assigned_at' | 'emi_focus_areas_manual_edit' | 'email_company_mismatch' | 'email_mismatch_dismissed' | 'is_law_firm' | 'is_consultant' | 'classification_reason' | 'classified_at'> & {
  email_status?: string | null;
  sic_codes?: string[] | null;
  naics_codes?: string[] | null;
  company_keywords?: string[] | null;
  last_enriched_at?: string | null;
  emi_focus_areas?: string[];
  emi_focus_areas_assigned_at?: string | null;
  emi_focus_areas_manual_edit?: boolean;
  email_company_mismatch?: boolean;
  email_mismatch_dismissed?: boolean;
  is_law_firm?: boolean | null;
  is_consultant?: boolean | null;
  classification_reason?: string | null;
  classified_at?: string | null;
};
export type DistributionContactUpdate = Partial<DistributionContactInsert>;

export type UpdatedTimePeriod = 'week' | 'month' | '3months' | '6months' | 'year' | null;

export interface ContactFilters {
  sectors?: string[];
  naicsSectors?: string[];  // Multi-select for NAICS-derived sectors
  emiFocusAreas?: string[]; // Multi-select for EMI Focus Areas
  countries?: string[];     // Multi-select for countries
  relationship_owners?: string[]; // Multi-select for owners
  gender?: 'male' | 'female' | 'unknown';
  company?: string;
  do_not_contact?: boolean;
  search?: string;
  updatedPeriod?: UpdatedTimePeriod;
  enrichedPeriod?: UpdatedTimePeriod;
  // AI classification exclusion filters
  excludeLawFirms?: boolean;
  excludeConsultants?: boolean;
  // Legacy single-value filters (for backwards compatibility)
  naicsSector?: string;
  emiFocusArea?: string;
  country?: string;
  relationship_owner?: string;
}

// Helper to get date cutoff for period filters
function getPeriodCutoff(period: UpdatedTimePeriod): Date | null {
  if (!period) return null;
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '3months':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '6months':
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export function useDistributionContacts(filters?: ContactFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-contacts", user?.id, filters],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("distribution_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("full_name", { ascending: true });

      // Single-value country filter (legacy)
      if (filters?.country) {
        query = query.eq("country", filters.country);
      }
      if (filters?.gender) {
        query = query.eq("gender", filters.gender);
      }
      if (filters?.company) {
        query = query.ilike("company", `%${filters.company}%`);
      }
      // Single-value relationship_owner filter (legacy)
      if (filters?.relationship_owner) {
        query = query.eq("relationship_owner", filters.relationship_owner);
      }
      if (filters?.do_not_contact !== undefined) {
        query = query.eq("do_not_contact", filters.do_not_contact);
      }
      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by sectors in JS (array overlap)
      let contacts = (data || []) as DistributionContact[];
      if (filters?.sectors && filters.sectors.length > 0) {
        contacts = contacts.filter(c => 
          c.sectors.some(s => filters.sectors!.includes(s))
        );
      }
      
      // Filter by updated period in JS
      if (filters?.updatedPeriod) {
        const cutoff = getPeriodCutoff(filters.updatedPeriod);
        if (cutoff) {
          const cutoffStr = cutoff.toISOString();
          contacts = contacts.filter(c => c.updated_at >= cutoffStr);
        }
      }
      
      // Filter by enriched period in JS
      if (filters?.enrichedPeriod) {
        const cutoff = getPeriodCutoff(filters.enrichedPeriod);
        if (cutoff) {
          const cutoffStr = cutoff.toISOString();
          contacts = contacts.filter(c => 
            c.last_enriched_at && c.last_enriched_at >= cutoffStr
          );
        }
      }
      
      // Multi-select: Filter by NAICS-derived sectors (OR within, AND with other filters)
      if (filters?.naicsSectors && filters.naicsSectors.length > 0) {
        contacts = contacts.filter(c => {
          const sector = getPrimaryNaicsSector(c.naics_codes);
          return sector && filters.naicsSectors!.includes(sector);
        });
      }
      // Legacy single-value NAICS sector filter
      else if (filters?.naicsSector) {
        contacts = contacts.filter(c => {
          const sector = getPrimaryNaicsSector(c.naics_codes);
          return sector === filters.naicsSector;
        });
      }
      
      // Multi-select: Filter by countries (OR within, AND with other filters)
      if (filters?.countries && filters.countries.length > 0) {
        contacts = contacts.filter(c => 
          c.country && filters.countries!.includes(c.country)
        );
      }
      
      // Multi-select: Filter by relationship owners (OR within, AND with other filters)
      if (filters?.relationship_owners && filters.relationship_owners.length > 0) {
        contacts = contacts.filter(c => 
          c.relationship_owner && filters.relationship_owners!.includes(c.relationship_owner)
        );
      }
      
      // Multi-select: Filter by EMI Focus Areas (OR within, AND with other filters)
      if (filters?.emiFocusAreas && filters.emiFocusAreas.length > 0) {
        contacts = contacts.filter(c => 
          c.emi_focus_areas?.some(area => filters.emiFocusAreas!.includes(area))
        );
      }
      // Legacy single-value EMI Focus Area filter
      else if (filters?.emiFocusArea) {
        contacts = contacts.filter(c => 
          c.emi_focus_areas?.includes(filters.emiFocusArea!)
        );
      }

      // Note: excludeLawFirms and excludeConsultants are applied at the UI level
      // (in ContactsListView) so they filter the currently visible list, not the entire dataset

      return contacts;
    },
    enabled: !!user,
  });
}

export function useDistributionContact(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-contact", id],
    queryFn: async () => {
      if (!user || !id) return null;

      const { data, error } = await supabase
        .from("distribution_contacts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data as DistributionContact;
    },
    enabled: !!user && !!id,
  });
}

export function useCreateDistributionContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contact: DistributionContactInsert) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("distribution_contacts")
        .insert({
          ...contact,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      toast.success("Contact created");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("A contact with this email already exists");
      } else {
        toast.error("Failed to create contact");
      }
    },
  });
}

export function useUpdateDistributionContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: DistributionContactUpdate & { id: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("distribution_contacts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-contact", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts-companies"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts-countries"] });
      toast.success("Contact updated");
    },
    onError: () => {
      toast.error("Failed to update contact");
    },
  });
}

export function useDeleteDistributionContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("distribution_contacts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      toast.success("Contact deleted");
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });
}

export function useBulkDeleteDistributionContacts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("distribution_contacts")
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);

      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      toast.success(`${count} contact${count !== 1 ? 's' : ''} deleted`);
    },
    onError: () => {
      toast.error("Failed to delete contacts");
    },
  });
}

export function useBulkCreateDistributionContacts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contacts: DistributionContactInsert[]) => {
      if (!user) throw new Error("Not authenticated");

      const contactsWithUser = contacts.map(c => ({
        ...c,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from("distribution_contacts")
        .upsert(contactsWithUser, { 
          onConflict: 'user_id,email',
          ignoreDuplicates: false 
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts-companies"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-contacts-countries"] });
      toast.success(`${data?.length || 0} contacts imported`);
    },
    onError: () => {
      toast.error("Failed to import contacts");
    },
  });
}

export function useDistinctCountries() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-contacts-countries", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_contacts")
        .select("country")
        .eq("user_id", user.id)
        .not("country", "is", null);

      if (error) throw error;
      
      const countries = [...new Set(data?.map(d => d.country).filter(Boolean) as string[])];
      return countries.sort();
    },
    enabled: !!user,
  });
}

export function useDistinctCompanies() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["distribution-contacts-companies", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("distribution_contacts")
        .select("company")
        .eq("user_id", user.id)
        .not("company", "is", null);

      if (error) throw error;
      
      const companies = [...new Set(data?.map(d => d.company).filter(Boolean) as string[])];
      return companies.sort();
    },
    enabled: !!user,
  });
}
