import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

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
}

export type DistributionContactInsert = Omit<DistributionContact, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type DistributionContactUpdate = Partial<DistributionContactInsert>;

export interface ContactFilters {
  sectors?: string[];
  country?: string;
  gender?: 'male' | 'female' | 'unknown';
  company?: string;
  relationship_owner?: string;
  do_not_contact?: boolean;
  search?: string;
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

      if (filters?.country) {
        query = query.eq("country", filters.country);
      }
      if (filters?.gender) {
        query = query.eq("gender", filters.gender);
      }
      if (filters?.company) {
        query = query.ilike("company", `%${filters.company}%`);
      }
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
