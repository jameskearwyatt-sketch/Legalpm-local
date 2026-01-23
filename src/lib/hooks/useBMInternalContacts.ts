import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

// Expertise structure matching the Excel categories
export interface ExpertiseCategory {
  // Renewables
  offshore_wind?: boolean;
  onshore_wind?: boolean;
  solar?: boolean;
  hydro?: boolean;
  geothermal?: boolean;
  corporate_ppa?: boolean;
  battery_storage?: boolean;
  // Power
  power_conventional?: boolean;
  nuclear?: boolean;
  waste_to_power?: boolean;
  // Clean Tech
  hydrogen?: boolean;
  ccus?: boolean;
  sustainable_fuels?: boolean;
  // M (Metals & Mining)
  metals_mining?: boolean;
  // O&G
  upstream_og?: boolean;
  midstream_og?: boolean;
  downstream_og?: boolean;
  lng_specialist?: boolean;
  shipping_og?: boolean;
  fsru?: boolean;
  petchems?: boolean;
  // Infrastructure
  airports?: boolean;
  ports_terminals?: boolean;
  roads_bridges_tunnels?: boolean;
  datacenters?: boolean;
  dt_other?: boolean;
  power_transmission_grids?: boolean;
  rail?: boolean;
  water_waste_management?: boolean;
  healthcare?: boolean;
  other_social_infra?: boolean;
  // Carbon
  carbon_transactions?: boolean;
  carbon_infra?: boolean;
  carbon_regulatory?: boolean;
  // Specialist
  construction_specialist?: boolean;
  regulatory_specialist?: boolean;
  any_shipping_work?: boolean;
  // Project Finance specific
  renewables_pf?: boolean;
  infrastructure_pf?: boolean;
  ppp?: boolean;
  oil_gas?: boolean; // Single O&G field in M&A and PF sections
}

export interface BMInternalContactExpertise {
  project_development: ExpertiseCategory;
  ma: ExpertiseCategory;
  project_finance: ExpertiseCategory;
}

export interface BMInternalContact {
  id: string;
  user_id: string;
  first_name: string;
  surname: string;
  title: string | null;
  region: string | null;
  office: string | null;
  practice_group: string | null;
  email: string | null;
  expertise: BMInternalContactExpertise;
  created_at: string;
  updated_at: string;
}

export type BMInternalContactInsert = Omit<BMInternalContact, 'id' | 'created_at' | 'updated_at'>;
export type BMInternalContactUpdate = Partial<BMInternalContactInsert>;

export interface BMContactFilters {
  search?: string;
  regions?: string[];
  offices?: string[];
  practiceGroups?: string[];
  expertiseAreas?: string[]; // e.g., ['project_development.offshore_wind', 'ma.nuclear']
}

// Helper to check if contact has specific expertise
export function hasExpertise(
  expertise: BMInternalContactExpertise,
  path: string
): boolean {
  const [category, field] = path.split('.');
  const cat = expertise[category as keyof BMInternalContactExpertise];
  if (!cat) return false;
  return cat[field as keyof ExpertiseCategory] === true;
}

// Count total expertise areas for a contact
export function countExpertiseAreas(expertise: BMInternalContactExpertise): number {
  let count = 0;
  for (const category of Object.values(expertise)) {
    if (category && typeof category === 'object') {
      for (const value of Object.values(category)) {
        if (value === true) count++;
      }
    }
  }
  return count;
}

// Get all expertise areas as a flat list of labels
export function getExpertiseLabels(
  expertise: BMInternalContactExpertise,
  category?: 'project_development' | 'ma' | 'project_finance'
): string[] {
  const labels: string[] = [];
  const labelMap: Record<string, string> = {
    offshore_wind: 'Offshore Wind',
    onshore_wind: 'Onshore Wind',
    solar: 'Solar',
    hydro: 'Hydro',
    geothermal: 'Geothermal',
    corporate_ppa: 'Corporate PPA',
    battery_storage: 'Battery Storage',
    power_conventional: 'Power Conventional',
    nuclear: 'Nuclear',
    waste_to_power: 'Waste-to-Power',
    hydrogen: 'Hydrogen',
    ccus: 'CCUS',
    sustainable_fuels: 'Sustainable Fuels',
    metals_mining: 'Metals & Mining',
    upstream_og: 'Upstream O&G',
    midstream_og: 'Midstream O&G',
    downstream_og: 'Downstream O&G',
    lng_specialist: 'LNG Specialist',
    shipping_og: 'Shipping O&G',
    fsru: 'FSRU',
    petchems: 'Petchems',
    airports: 'Airports',
    ports_terminals: 'Ports & Terminals',
    roads_bridges_tunnels: 'Roads, Bridges & Tunnels',
    datacenters: 'Datacenters',
    dt_other: 'D&T: Other',
    power_transmission_grids: 'Power & Transmission Grids',
    rail: 'Rail',
    water_waste_management: 'Water & Waste Management',
    healthcare: 'Healthcare',
    other_social_infra: 'Other Social Infra',
    carbon_transactions: 'Carbon Transactions',
    carbon_infra: 'Carbon Infra',
    carbon_regulatory: 'Carbon Regulatory',
    construction_specialist: 'Construction Specialist',
    regulatory_specialist: 'Regulatory Specialist',
    any_shipping_work: 'Any Shipping Work',
    renewables_pf: 'Renewables',
    infrastructure_pf: 'Infrastructure',
    ppp: 'PPP',
    oil_gas: 'Oil & Gas',
  };

  const categories = category ? [category] : ['project_development', 'ma', 'project_finance'] as const;
  
  for (const cat of categories) {
    const catData = expertise[cat];
    if (catData && typeof catData === 'object') {
      for (const [key, value] of Object.entries(catData)) {
        if (value === true && labelMap[key]) {
          labels.push(labelMap[key]);
        }
      }
    }
  }
  
  return [...new Set(labels)]; // Remove duplicates
}

export function useBMInternalContacts(filters?: BMContactFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bm-internal-contacts', user?.id, filters],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('bm_internal_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('surname', { ascending: true });

      if (error) throw error;

      let contacts = (data || []).map(d => ({
        ...d,
        expertise: (d.expertise || { project_development: {}, ma: {}, project_finance: {} }) as BMInternalContactExpertise,
      })) as BMInternalContact[];

      // Apply filters
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        contacts = contacts.filter(c => 
          c.first_name.toLowerCase().includes(search) ||
          c.surname.toLowerCase().includes(search) ||
          c.office?.toLowerCase().includes(search) ||
          c.practice_group?.toLowerCase().includes(search)
        );
      }

      if (filters?.regions?.length) {
        contacts = contacts.filter(c => 
          c.region && filters.regions!.includes(c.region)
        );
      }

      if (filters?.offices?.length) {
        contacts = contacts.filter(c => 
          c.office && filters.offices!.includes(c.office)
        );
      }

      if (filters?.practiceGroups?.length) {
        contacts = contacts.filter(c => 
          c.practice_group && filters.practiceGroups!.includes(c.practice_group)
        );
      }

      if (filters?.expertiseAreas?.length) {
        contacts = contacts.filter(c => 
          filters.expertiseAreas!.some(area => hasExpertise(c.expertise, area))
        );
      }

      return contacts;
    },
    enabled: !!user,
  });
}

export function useBMInternalContact(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bm-internal-contact', id],
    queryFn: async () => {
      if (!id || !user) return null;

      const { data, error } = await supabase
        .from('bm_internal_contacts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return {
        ...data,
        expertise: (data.expertise || { project_development: {}, ma: {}, project_finance: {} }) as BMInternalContactExpertise,
      } as BMInternalContact;
    },
    enabled: !!id && !!user,
  });
}

export function useCreateBMInternalContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contact: Omit<BMInternalContactInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const insertData = { 
        ...contact, 
        expertise: contact.expertise as unknown as object, 
        user_id: user.id 
      };
      const { data, error } = await (supabase
        .from('bm_internal_contacts') as any)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-internal-contacts'] });
      toast.success('Contact added');
    },
    onError: (error) => {
      toast.error('Failed to add contact: ' + error.message);
    },
  });
}

export function useBulkCreateBMInternalContacts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contacts: Omit<BMInternalContactInsert, 'user_id'>[]) => {
      if (!user) throw new Error('Not authenticated');

      const contactsWithUser = contacts.map(c => ({ 
        ...c, 
        expertise: c.expertise as unknown as object,
        user_id: user.id 
      }));

      const { data, error } = await (supabase
        .from('bm_internal_contacts') as any)
        .insert(contactsWithUser)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bm-internal-contacts'] });
      toast.success(`Imported ${data.length} contacts`);
    },
    onError: (error) => {
      toast.error('Failed to import contacts: ' + error.message);
    },
  });
}

export function useUpdateBMInternalContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: BMInternalContactUpdate & { id: string }) => {
      const updateData = updates.expertise 
        ? { ...updates, expertise: updates.expertise as unknown as object }
        : updates;
      const { data, error } = await (supabase
        .from('bm_internal_contacts') as any)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-internal-contacts'] });
      toast.success('Contact updated');
    },
    onError: (error) => {
      toast.error('Failed to update contact: ' + error.message);
    },
  });
}

export function useDeleteBMInternalContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bm_internal_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm-internal-contacts'] });
      toast.success('Contact deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete contact: ' + error.message);
    },
  });
}

// Distinct values for filters
export function useDistinctBMRegions() {
  const { data: contacts } = useBMInternalContacts();
  
  const regions = [...new Set(
    (contacts || [])
      .map(c => c.region)
      .filter((r): r is string => !!r)
  )].sort();
  
  return regions;
}

export function useDistinctBMOffices() {
  const { data: contacts } = useBMInternalContacts();
  
  const offices = [...new Set(
    (contacts || [])
      .map(c => c.office)
      .filter((o): o is string => !!o)
  )].sort();
  
  return offices;
}

export function useDistinctBMPracticeGroups() {
  const { data: contacts } = useBMInternalContacts();
  
  const groups = [...new Set(
    (contacts || [])
      .map(c => c.practice_group)
      .filter((g): g is string => !!g)
  )].sort();
  
  return groups;
}
