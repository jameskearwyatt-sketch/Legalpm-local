import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface DealCredential {
  id: string;
  user_id: string;
  matter_id: string | null;
  deal_name: string;
  client_name: string;
  client_public_name: string | null;
  description: string | null;
  deal_type: string | null;
  practice_areas: string[] | null;
  sector: string | null;
  jurisdictions: string[] | null;
  deal_value: number | null;
  deal_currency: string | null;
  role_played: string | null;
  lead_partner: string | null;
  has_institutional_involvement: boolean;
  institutions: string[] | null;
  start_date: string | null;
  completion_date: string | null;
  year_completed: number | null;
  status: 'Active' | 'Completed' | 'Ongoing';
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CreateCredentialInput {
  matter_id?: string | null;
  deal_name: string;
  client_name: string;
  client_public_name?: string | null;
  description?: string | null;
  deal_type?: string | null;
  practice_areas?: string[] | null;
  sector?: string | null;
  jurisdictions?: string[] | null;
  deal_value?: number | null;
  deal_currency?: string | null;
  role_played?: string | null;
  lead_partner?: string | null;
  has_institutional_involvement?: boolean;
  institutions?: string[] | null;
  start_date?: string | null;
  completion_date?: string | null;
  year_completed?: number | null;
  status?: 'Active' | 'Completed' | 'Ongoing';
  is_auto_generated?: boolean;
}

export interface CredentialFilters {
  dealType?: string;
  sector?: string;
  jurisdiction?: string;
  yearFrom?: number;
  yearTo?: number;
  search?: string;
  status?: string;
  hasInstitutions?: boolean;
}

export const PRACTICE_AREAS = [
  'Corporate', 'JVs', 'Financing', 'Project Finance', 'M&A',
  'PPP/Concessions', 'Regulatory', 'Construction', 'Real Estate',
  'Tax', 'Employment', 'IP', 'Dispute Resolution', 'Environmental', 'Competition',
];

export const SECTOR_PRESETS = [
  'Energy', 'Renewables', 'Oil & Gas', 'Mining', 'Infrastructure',
  'Transport', 'TMT', 'Financial Services', 'Healthcare',
  'Agriculture', 'Manufacturing', 'Water & Sanitation', 'Education',
];

export const INSTITUTION_PRESETS = [
  'IFC', 'EBRD', 'ADB', 'AfDB', 'DFC (OPIC)', 'MIGA', 'EIB', 'KfW',
  'FMO', 'DEG', 'CDC/BII', 'Proparco', 'AIIB', 'IsDB', 'NDB',
  'JICA/JBIC', 'BNDES', 'Norfund', 'Swedfund', 'Finnfund',
];

export const ROLE_OPTIONS = [
  'Lead counsel', 'Local counsel', 'Supporting counsel',
];

export const DEAL_TYPE_PRESETS = [
  'PPA', 'Tolling', 'Carbon', 'M&A', 'Financing', 'Advisory',
  'Project Development', 'Concession', 'JV', 'Regulatory',
];

export function generateDescription(cred: Partial<DealCredential>): string {
  const parts: string[] = [];

  const client = cred.client_name || 'a client';
  const jurisdictionStr = cred.jurisdictions?.length
    ? cred.jurisdictions.join(', ')
    : null;

  let main = `Advised ${client}`;
  if (cred.deal_value && cred.deal_currency) {
    main += ` on a ${cred.deal_currency} ${cred.deal_value.toLocaleString()}`;
  } else if (cred.deal_value) {
    main += ` on a USD ${cred.deal_value.toLocaleString()}`;
  } else {
    main += ' on a';
  }

  if (cred.deal_type) {
    main += ` ${cred.deal_type}`;
  }
  main += ' transaction';
  if (jurisdictionStr) {
    main += ` in ${jurisdictionStr}`;
  }
  main += '.';
  parts.push(main);

  if (cred.role_played && cred.role_played !== 'Lead counsel') {
    parts.push(`Acting as ${cred.role_played.toLowerCase()}.`);
  }

  if (cred.year_completed) {
    parts.push(`Completed ${cred.year_completed}.`);
  }

  return parts.join(' ');
}

export function useCredentials(filters?: CredentialFilters) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const credentialsQuery = useQuery({
    queryKey: ['credentials', user?.id, filters],
    queryFn: async () => {
      let query = supabase
        .from('deal_credentials' as never)
        .select('*')
        .order('year_completed', { ascending: false } as never)
        .order('created_at', { ascending: false } as never);

      if (filters?.dealType) {
        query = query.eq('deal_type', filters.dealType);
      }
      if (filters?.sector) {
        query = query.eq('sector', filters.sector);
      }
      if (filters?.jurisdiction) {
        query = query.contains('jurisdictions', [filters.jurisdiction]);
      }
      if (filters?.yearFrom) {
        query = query.gte('year_completed', filters.yearFrom);
      }
      if (filters?.yearTo) {
        query = query.lte('year_completed', filters.yearTo);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.hasInstitutions !== undefined && filters.hasInstitutions) {
        query = query.eq('has_institutional_involvement', true);
      }
      if (filters?.search) {
        query = query.or(
          `deal_name.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as DealCredential[];
    },
    enabled: !!user,
  });

  const createCredential = useMutation({
    mutationFn: async (input: CreateCredentialInput) => {
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .insert({
          ...input,
          user_id: user!.id,
          created_by: user!.id,
          updated_by: user!.id,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DealCredential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast({ title: 'Credential created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create credential', description: error.message, variant: 'destructive' });
    },
  });

  const updateCredential = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateCredentialInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .update({
          ...input,
          updated_by: user!.id,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, id as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DealCredential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast({ title: 'Credential updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update credential', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCredential = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('deal_credentials' as never)
        .delete()
        .eq('id' as never, id as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast({ title: 'Credential deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete credential', description: error.message, variant: 'destructive' });
    },
  });

  const bulkCreateCredentials = useMutation({
    mutationFn: async (inputs: CreateCredentialInput[]) => {
      const rows = inputs.map(input => ({
        ...input,
        user_id: user!.id,
        created_by: user!.id,
        updated_by: user!.id,
      }));
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .insert(rows as never)
        .select();
      if (error) throw error;
      return (data || []) as unknown as DealCredential[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      toast({ title: `${(data as DealCredential[]).length} credentials imported successfully` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to import credentials', description: error.message, variant: 'destructive' });
    },
  });

  const syncFromMatters = useMutation({
    mutationFn: async () => {
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select('id, matter_name, client_id, practice_area, jurisdictions, deal_value, deal_currency, lead_partner, start_date, target_close_date, category, status, clients (name)')
        .in('category', ['Live', 'Closed']);
      if (mattersError) throw mattersError;
      if (!matters || matters.length === 0) return 0;

      const { data: existing, error: existingError } = await supabase
        .from('deal_credentials' as never)
        .select('matter_id')
        .eq('is_auto_generated' as never, true as never);
      if (existingError) throw existingError;

      const linkedMatterIds = new Set(
        ((existing || []) as unknown as { matter_id: string }[])
          .map(e => e.matter_id)
          .filter(Boolean)
      );

      const newMatters = matters.filter(m => !linkedMatterIds.has(m.id));
      if (newMatters.length === 0) return 0;

      const rows = newMatters.map(m => {
        const clientName = (m.clients as { name: string } | null)?.name || 'Unknown Client';
        const status: 'Active' | 'Completed' = m.category === 'Closed' ? 'Completed' : 'Active';
        const yearCompleted = m.target_close_date
          ? new Date(m.target_close_date).getFullYear()
          : (m.category === 'Closed' ? new Date().getFullYear() : null);

        const cred: Record<string, unknown> = {
          user_id: user!.id,
          matter_id: m.id,
          deal_name: m.matter_name,
          client_name: clientName,
          practice_areas: m.practice_area ? [m.practice_area] : null,
          jurisdictions: m.jurisdictions || null,
          deal_value: m.deal_value,
          deal_currency: m.deal_currency || 'USD',
          lead_partner: m.lead_partner,
          start_date: m.start_date,
          completion_date: m.target_close_date,
          year_completed: yearCompleted,
          status,
          is_auto_generated: true,
          created_by: user!.id,
          updated_by: user!.id,
        };

        cred.description = generateDescription(cred as Partial<DealCredential>);
        return cred;
      });

      const { error: insertError } = await supabase
        .from('deal_credentials' as never)
        .insert(rows as never);
      if (insertError) throw insertError;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
      if (count && count > 0) {
        toast({ title: `Synced ${count} credential${count === 1 ? '' : 's'} from matters` });
      } else {
        toast({ title: 'All matters already synced' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to sync from matters', description: error.message, variant: 'destructive' });
    },
  });

  const usedSectors = useQuery({
    queryKey: ['credentials-sectors', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .select('sector');
      if (error) throw error;
      const sectors = new Set<string>();
      ((data || []) as unknown as { sector: string | null }[]).forEach(row => {
        if (row.sector) sectors.add(row.sector);
      });
      SECTOR_PRESETS.forEach(s => sectors.add(s));
      return [...sectors].sort();
    },
    enabled: !!user,
  });

  const usedDealTypes = useQuery({
    queryKey: ['credentials-deal-types', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .select('deal_type');
      if (error) throw error;
      const types = new Set<string>();
      ((data || []) as unknown as { deal_type: string | null }[]).forEach(row => {
        if (row.deal_type) types.add(row.deal_type);
      });
      DEAL_TYPE_PRESETS.forEach(t => types.add(t));
      return [...types].sort();
    },
    enabled: !!user,
  });

  const usedJurisdictions = useQuery({
    queryKey: ['credentials-jurisdictions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_credentials' as never)
        .select('jurisdictions');
      if (error) throw error;
      const jurisdictions = new Set<string>();
      ((data || []) as unknown as { jurisdictions: string[] | null }[]).forEach(row => {
        if (row.jurisdictions) row.jurisdictions.forEach(j => jurisdictions.add(j));
      });
      return [...jurisdictions].sort();
    },
    enabled: !!user,
  });

  return {
    credentials: credentialsQuery.data || [],
    isLoading: credentialsQuery.isLoading,
    error: credentialsQuery.error,
    createCredential,
    updateCredential,
    deleteCredential,
    bulkCreateCredentials,
    syncFromMatters,
    allSectors: usedSectors.data || SECTOR_PRESETS,
    allDealTypes: usedDealTypes.data || DEAL_TYPE_PRESETS,
    allJurisdictions: usedJurisdictions.data || [],
  };
}
