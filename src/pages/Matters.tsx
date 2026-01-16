import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableScrollControls } from '@/components/ui/table-scroll-controls';
import { StickyTableHeader } from '@/components/ui/sticky-table-header';
import { useMatters, MatterWithFinancials, MatterCategory, MatterStage } from '@/lib/hooks/useMatters';
import { useClients } from '@/lib/hooks/useClients';
import { useSnapshots } from '@/lib/hooks/useSnapshots';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { EditableFinancialCell } from '@/components/matters/EditableFinancialCell';
import { BilledAmountCell } from '@/components/matters/BilledAmountCell';
import { Search, Plus, ArrowUpDown, Loader2, Briefcase, TrendingUp, CheckCircle2, XCircle, MoreHorizontal, ArrowRightCircle, AlertTriangle, Clock, Users, Building2, Save, Trash2, Filter, X, ChevronDown, Upload, History, Eye, Lightbulb } from 'lucide-react';
import { MasterWipUpdateDialog } from '@/components/matters/MasterWipUpdateDialog';
import { DisbursementReviewResult } from '@/components/matters/DisbursementReviewDialog';
import { MasterWipHistoryDialog } from '@/components/matters/MasterWipHistoryDialog';
import { useMasterWipUpdates } from '@/lib/hooks/useMasterWipUpdates';
import { useHighlightMovements } from '@/lib/hooks/useHighlightMovements';
import { HighlightedFinancialValue } from '@/components/matters/HighlightedFinancialValue';
import { format, differenceInDays, parseISO, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency, convertToUsd } from '@/lib/currencyUtils';
import { useExchangeRates } from '@/lib/hooks/useExchangeRates';
import { getClientDisplayName } from '@/lib/clientUtils';

type SortField = 'matter_name' | 'fee_amount' | 'bm_fee' | 'headroom' | 'headroom_pct' | 'wip' | 'ar' | 'paid' | 'budget_burn' | 'budget_burn_pct' | 'local_burn_pct' | 'local_counsel' | 'stage';
type SortDirection = 'asc' | 'desc';
type TabFilter = MatterCategory | 'MMA/BP' | 'Clients';

// Stage options based on category
const liveStages: MatterStage[] = ['Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused'];
const pipelineStages: MatterStage[] = ['Pending', 'Won', 'Lost'];

const categoryIcons: Record<MatterCategory, React.ReactNode> = {
  Live: <Briefcase className="h-4 w-4" />,
  Pipeline: <TrendingUp className="h-4 w-4" />,
  Closed: <CheckCircle2 className="h-4 w-4" />,
  Lost: <XCircle className="h-4 w-4" />,
};

// MMA/BP inline editing row component
interface MmaBpTableRowProps {
  matter: MatterWithFinancials;
  userProfile: { full_name: string | null } | null | undefined;
  updateMatter: {
    mutateAsync: (input: { id: string; lead_partner?: string; matter_managing_attorney?: string }) => Promise<unknown>;
    isPending?: boolean;
  };
}

function MmaBpTableRow({ matter, userProfile, updateMatter }: MmaBpTableRowProps) {
  const [bpValue, setBpValue] = useState(matter.lead_partner || '');
  const [mmaValue, setMmaValue] = useState(matter.matter_managing_attorney || '');
  const [isBpMe, setIsBpMe] = useState(
    !!userProfile?.full_name && matter.lead_partner === userProfile.full_name
  );
  const [isMmaMe, setIsMmaMe] = useState(
    !!userProfile?.full_name && matter.matter_managing_attorney === userProfile.full_name
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when matter changes
  useMemo(() => {
    setBpValue(matter.lead_partner || '');
    setMmaValue(matter.matter_managing_attorney || '');
    setIsBpMe(!!userProfile?.full_name && matter.lead_partner === userProfile.full_name);
    setIsMmaMe(!!userProfile?.full_name && matter.matter_managing_attorney === userProfile.full_name);
  }, [matter.lead_partner, matter.matter_managing_attorney, userProfile?.full_name]);

  const handleBpMeChange = async (checked: boolean) => {
    setIsSaving(true);
    try {
      if (checked && userProfile?.full_name) {
        await updateMatter.mutateAsync({ id: matter.id, lead_partner: userProfile.full_name });
        setBpValue(userProfile.full_name);
        setIsBpMe(true);
      } else {
        await updateMatter.mutateAsync({ id: matter.id, lead_partner: '' });
        setBpValue('');
        setIsBpMe(false);
      }
    } catch (error) {
      toast.error('Failed to update Billing Partner');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMmaMeChange = async (checked: boolean) => {
    setIsSaving(true);
    try {
      if (checked && userProfile?.full_name) {
        await updateMatter.mutateAsync({ id: matter.id, matter_managing_attorney: userProfile.full_name });
        setMmaValue(userProfile.full_name);
        setIsMmaMe(true);
      } else {
        await updateMatter.mutateAsync({ id: matter.id, matter_managing_attorney: '' });
        setMmaValue('');
        setIsMmaMe(false);
      }
    } catch (error) {
      toast.error('Failed to update MMA');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBpBlur = async () => {
    if (bpValue !== matter.lead_partner) {
      setIsSaving(true);
      try {
        await updateMatter.mutateAsync({ id: matter.id, lead_partner: bpValue });
        setIsBpMe(!!userProfile?.full_name && bpValue === userProfile.full_name);
      } catch (error) {
        toast.error('Failed to update Billing Partner');
        setBpValue(matter.lead_partner || '');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleMmaBlur = async () => {
    if (mmaValue !== matter.matter_managing_attorney) {
      setIsSaving(true);
      try {
        await updateMatter.mutateAsync({ id: matter.id, matter_managing_attorney: mmaValue });
        setIsMmaMe(!!userProfile?.full_name && mmaValue === userProfile.full_name);
      } catch (error) {
        toast.error('Failed to update MMA');
        setMmaValue(matter.matter_managing_attorney || '');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <TableRow className="group">
      <TableCell className="sticky left-0 z-10 bg-background max-w-[200px]">
        <Link 
          to={`/matters/${matter.id}`}
          className="block hover:text-primary transition-colors"
        >
          <p className="font-medium text-foreground">{getClientDisplayName(matter.clients)}</p>
          <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors line-clamp-2" title={matter.matter_name}>
            {(matter as any).matter_display_name || matter.matter_name}
          </p>
        </Link>
      </TableCell>
      <TableCell>
        <span className={cn(
          "text-xs font-medium px-2 py-1 rounded",
          matter.category === 'Live' && 'bg-green-100 text-green-700',
          matter.category === 'Pipeline' && 'bg-blue-100 text-blue-700'
        )}>
          {matter.category}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {userProfile?.full_name && (
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`bp-me-${matter.id}`}
                checked={isBpMe}
                onCheckedChange={handleBpMeChange}
                disabled={isSaving}
                className="h-4 w-4"
              />
              <label htmlFor={`bp-me-${matter.id}`} className="text-sm text-muted-foreground cursor-pointer">
                Me
              </label>
            </div>
          )}
          <Input
            value={bpValue}
            onChange={(e) => setBpValue(e.target.value)}
            onBlur={handleBpBlur}
            disabled={isSaving || isBpMe}
            placeholder="Enter name..."
            className="h-8 text-sm flex-1"
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {userProfile?.full_name && (
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`mma-me-${matter.id}`}
                checked={isMmaMe}
                onCheckedChange={handleMmaMeChange}
                disabled={isSaving}
                className="h-4 w-4"
              />
              <label htmlFor={`mma-me-${matter.id}`} className="text-sm text-muted-foreground cursor-pointer">
                Me
              </label>
            </div>
          )}
          <Input
            value={mmaValue}
            onChange={(e) => setMmaValue(e.target.value)}
            onBlur={handleMmaBlur}
            disabled={isSaving || isMmaMe}
            placeholder="Enter name..."
            className="h-8 text-sm flex-1"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

// Clients Tab Content
interface ClientsTabContentProps {
  clients: { id: string; name: string; display_name: string | null }[];
  clientsInUse: Set<string>;
  isLoading: boolean;
  updateClient: {
    mutateAsync: (input: { id: string; name?: string; display_name?: string | null }) => Promise<unknown>;
    isPending?: boolean;
  };
  deleteClient: {
    mutateAsync: (id: string) => Promise<void>;
    isPending?: boolean;
  };
}

function ClientsTabContent({ clients, clientsInUse, isLoading, updateClient, deleteClient }: ClientsTabContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { activeClients, unusedClients } = useMemo(() => {
    let filtered = clients;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.display_name && c.display_name.toLowerCase().includes(term))
      );
    }
    
    const active = filtered.filter(c => clientsInUse.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    const unused = filtered.filter(c => !clientsInUse.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    
    return { activeClients: active, unusedClients: unused };
  }, [clients, clientsInUse, searchTerm]);

  const handleDelete = async (clientId: string) => {
    setDeletingId(clientId);
    try {
      await deleteClient.mutateAsync(clientId);
      toast.success('Client deleted');
    } catch (error) {
      toast.error('Failed to delete client');
    } finally {
      setDeletingId(null);
    }
  };

  const renderClientTable = (clientList: typeof clients, showDelete: boolean, title: string) => (
    <Card className="shadow-card">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-medium text-sm text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {clientList.length} client{clientList.length !== 1 ? 's' : ''}
          </p>
        </div>
        {clientList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No clients in this category</p>
          </div>
        ) : (
          <StickyTableHeader>
            <TableScrollControls>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[250px]">Full Client Name</TableHead>
                    <TableHead className="min-w-[200px]">Commonly Referred To</TableHead>
                    <TableHead className="min-w-[150px]">Display Preview</TableHead>
                    <TableHead className="w-16">Save</TableHead>
                    {showDelete && <TableHead className="w-16">Delete</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientList.map((client) => (
                    <ClientRowWithDelete
                      key={client.id}
                      client={client}
                      updateClient={updateClient}
                      showDelete={showDelete}
                      onDelete={() => handleDelete(client.id)}
                      isDeleting={deletingId === client.id}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableScrollControls>
          </StickyTableHeader>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Clients */}
          {renderClientTable(activeClients, false, 'Clients In Use')}
          
          {/* Unused Clients */}
          {unusedClients.length > 0 && renderClientTable(unusedClients, true, 'Unused Clients (can be deleted)')}
        </>
      )}
    </>
  );
}

// Extended ClientRow with delete option
interface ClientRowWithDeleteProps {
  client: { id: string; name: string; display_name: string | null };
  updateClient: {
    mutateAsync: (input: { id: string; name?: string; display_name?: string | null }) => Promise<unknown>;
    isPending?: boolean;
  };
  showDelete: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}

function ClientRowWithDelete({ client, updateClient, showDelete, onDelete, isDeleting }: ClientRowWithDeleteProps) {
  const [nameValue, setNameValue] = useState(client.name);
  const [displayNameValue, setDisplayNameValue] = useState(client.display_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useMemo(() => {
    setNameValue(client.name);
    setDisplayNameValue(client.display_name || '');
    setHasChanges(false);
  }, [client.name, client.display_name]);

  const handleNameChange = (value: string) => {
    setNameValue(value);
    setHasChanges(value !== client.name || displayNameValue !== (client.display_name || ''));
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayNameValue(value);
    setHasChanges(nameValue !== client.name || value !== (client.display_name || ''));
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await updateClient.mutateAsync({
        id: client.id,
        name: nameValue.trim() || client.name,
        display_name: displayNameValue.trim() || null,
      });
      setHasChanges(false);
      toast.success('Client updated');
    } catch (error) {
      toast.error('Failed to update client');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TableRow className="group">
      <TableCell>
        <Input
          value={nameValue}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={isSaving || isDeleting}
          placeholder="Client name..."
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <Input
          value={displayNameValue}
          onChange={(e) => handleDisplayNameChange(e.target.value)}
          disabled={isSaving || isDeleting}
          placeholder="Short name (optional)..."
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {displayNameValue.trim() || nameValue}
        </span>
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={hasChanges ? 'default' : 'ghost'}
          onClick={handleSave}
          disabled={isSaving || !hasChanges || isDeleting}
          className="h-8"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </TableCell>
      {showDelete && (
        <TableCell>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting || isSaving}
            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

export default function Matters() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { matters, isLoading, updateMatter } = useMatters();
  const { clients, updateClient, deleteClient, isLoading: clientsLoading } = useClients();
  const { upsertTodaySnapshot } = useSnapshots();
  const { data: exchangeRatesData } = useExchangeRates();
  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState<TabFilter>('Live');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [practiceAreaFilter, setPracticeAreaFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem('matters-sort-field');
    return (saved as SortField) || 'matter_name';
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem('matters-sort-direction');
    return (saved as SortDirection) || 'asc';
  });

  // Persist sort preferences to localStorage
  useEffect(() => {
    localStorage.setItem('matters-sort-field', sortField);
    localStorage.setItem('matters-sort-direction', sortDirection);
  }, [sortField, sortDirection]);
  const [showMasterWipDialog, setShowMasterWipDialog] = useState(false);
  const [showMasterWipHistoryDialog, setShowMasterWipHistoryDialog] = useState(false);
  const [isTogglingProposals, setIsTogglingProposals] = useState(false);
  const { createMasterUpdate, lastMasterChanges, lastMasterUpdateDate } = useMasterWipUpdates();
  const { masterHighlightEnabled, toggleMasterHighlight } = useHighlightMovements();
  
  // Compute matters that have selected WIP proposals
  const mattersWithProposals = useMemo(() => {
    return matters.filter(m => (m as any).selected_proposal);
  }, [matters]);
  
  // Check if all matters with proposals have show_shaping_proposal enabled
  const allProposalsApplied = useMemo(() => {
    if (mattersWithProposals.length === 0) return false;
    return mattersWithProposals.every(m => (m as any).show_shaping_proposal);
  }, [mattersWithProposals]);
  
  // Toggle all WIP proposals on/off
  const toggleAllProposals = async (apply: boolean) => {
    if (mattersWithProposals.length === 0) return;
    setIsTogglingProposals(true);
    try {
      const matterIds = mattersWithProposals.map(m => m.id);
      await supabase
        .from('matters')
        .update({ show_shaping_proposal: apply })
        .in('id', matterIds);
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      toast.success(apply ? 'All WIP proposals applied' : 'All WIP proposals disabled');
    } catch (error) {
      toast.error('Failed to toggle proposals');
    } finally {
      setIsTogglingProposals(false);
    }
  };

  // Build a map of matter_id -> change data for quick lookup when highlighting
  const masterChangesMap = useMemo(() => {
    const map = new Map<string, {
      before_wip_amount: number;
      before_billed_amount: number;
      before_paid_amount: number;
      before_accounts_receivable: number;
      before_wip_write_off_amount: number;
      created_at: string;
    }>();
    lastMasterChanges.forEach((change) => {
      map.set(change.matter_id, {
        before_wip_amount: change.before_wip_amount,
        before_billed_amount: change.before_billed_amount,
        before_paid_amount: change.before_paid_amount,
        before_accounts_receivable: change.before_accounts_receivable,
        before_wip_write_off_amount: change.before_wip_write_off_amount,
        created_at: change.created_at,
      });
    });
    return map;
  }, [lastMasterChanges]);

  // Fetch user profile for "Me" checkbox
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Derive categoryFilter from tabFilter for non-special tabs
  const categoryFilter = (tabFilter === 'MMA/BP' || tabFilter === 'Clients') ? null : tabFilter;

  // Fetch all matter_clients to support filtering by secondary clients on multi-client matters
  const { data: allMatterClients = [] } = useQuery({
    queryKey: ['all-matter-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matter_clients')
        .select('matter_id, client_id');
      if (error) throw error;
      return data as { matter_id: string; client_id: string }[];
    },
    enabled: !!user,
  });

  // Build a map of matter_id -> array of client_ids for quick lookup
  const matterToClientsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    allMatterClients.forEach((mc) => {
      if (!map[mc.matter_id]) {
        map[mc.matter_id] = [];
      }
      map[mc.matter_id].push(mc.client_id);
    });
    return map;
  }, [allMatterClients]);

  // Build a set of client IDs that are in use (have at least one matter)
  const clientsInUse = useMemo(() => {
    const usedIds = new Set<string>();
    matters.forEach((m) => {
      if (m.client_id) usedIds.add(m.client_id);
    });
    // Also add clients from multi-client relationships
    allMatterClients.forEach((mc) => {
      usedIds.add(mc.client_id);
    });
    return usedIds;
  }, [matters, allMatterClients]);

  // Extract unique practice areas from all matters
  const uniquePracticeAreas = useMemo(() => {
    const areas = new Set<string>();
    matters.forEach((m) => {
      if (m.practice_area && m.practice_area.trim()) {
        areas.add(m.practice_area.trim());
      }
    });
    return Array.from(areas).sort();
  }, [matters]);

  // Silent update for local counsel billing (no toast) - legacy matter-level
  const updateLocalCounselBilling = async (matterId: string, value: 'Direct' | 'Disb' | null) => {
    await supabase.from('matters').update({ local_counsel_billing: value }).eq('id', matterId);
    queryClient.invalidateQueries({ queryKey: ['matters'] });
  };

  // Update per-LC billing mode
  const updateLcBillingMode = async (lcId: string, value: 'Direct' | 'Disb' | null) => {
    await supabase.from('matter_local_counsels').update({ billing_mode: value }).eq('id', lcId);
    queryClient.invalidateQueries({ queryKey: ['matters'] });
    queryClient.invalidateQueries({ queryKey: ['local-counsels'] });
  };

  // Auto-summarize long matter names that don't have a display name yet
  useEffect(() => {
    const summarizeLongNames = async () => {
      const mattersNeedingSummary = matters.filter(
        (m) => m.matter_name.length > 60 && !(m as any).matter_display_name
      );
      
      // Process one at a time to avoid overwhelming the API
      for (const matter of mattersNeedingSummary.slice(0, 3)) {
        try {
          const response = await supabase.functions.invoke('summarize-matter-name', {
            body: { matterId: matter.id, matterName: matter.matter_name },
          });
          
          if (response.data?.saved) {
            // Refresh matters to get the updated display name
            queryClient.invalidateQueries({ queryKey: ['matters'] });
          }
        } catch (error) {
          console.error('Failed to summarize matter name:', error);
        }
      }
    };
    
    if (matters.length > 0) {
      summarizeLongNames();
    }
  }, [matters.length]); // Only re-run when matters count changes

  const handleCategoryChange = async (matterId: string, newCategory: MatterCategory, pipelineOutcome?: 'Won' | 'Lost') => {
    try {
      const updateData: any = { category: newCategory };
      
      // Set appropriate status based on category
      if (newCategory === 'Live') {
        updateData.status = 'Open';
        updateData.pipeline_outcome = 'Won';
      } else if (newCategory === 'Closed') {
        updateData.status = 'Closed';
      } else if (newCategory === 'Lost') {
        updateData.pipeline_outcome = 'Lost';
      }
      
      if (pipelineOutcome) {
        updateData.pipeline_outcome = pipelineOutcome;
      }
      
      await updateMatter.mutateAsync({ id: matterId, ...updateData });
      toast.success(`Matter moved to ${newCategory}`);
    } catch (error) {
      toast.error('Failed to move matter');
    }
  };

  const getCategoryActions = (matter: MatterWithFinancials) => {
    const actions: { label: string; category: MatterCategory; outcome?: 'Won' | 'Lost' }[] = [];
    
    switch (matter.category) {
      case 'Pipeline':
        actions.push({ label: 'Move to Live (Won)', category: 'Live', outcome: 'Won' });
        actions.push({ label: 'Mark as Lost', category: 'Lost', outcome: 'Lost' });
        break;
      case 'Live':
        actions.push({ label: 'Move to Closed', category: 'Closed' });
        break;
      case 'Closed':
        actions.push({ label: 'Reopen (Move to Live)', category: 'Live' });
        break;
      case 'Lost':
        actions.push({ label: 'Move to Pipeline', category: 'Pipeline' });
        break;
    }
    
    return actions;
  };

  // Use shared formatCurrency from currencyUtils - imported at top

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Calculate GBP to USD rate from exchange rates data
  // The API returns rates as "1 USD = X currency", so GBP rate tells us how many GBP per USD
  // To get USD per GBP: 1 / gbpRate
  const gbpToUsdRate = useMemo(() => {
    if (!exchangeRatesData?.rates?.GBP) return 1.35; // Default fallback
    // If 1 USD = 0.74 GBP, then 1 GBP = 1/0.74 USD = 1.35 USD
    return 1 / exchangeRatesData.rates.GBP;
  }, [exchangeRatesData]);

  // Get live rates for direct currency conversion
  const liveRates = exchangeRatesData?.rates as Record<string, number> | undefined;

  const filteredMatters = useMemo(() => {
    let result = [...matters];

    // Category filter - for MMA/BP tab, show Live and Pipeline only
    if (tabFilter === 'MMA/BP') {
      result = result.filter((m) => m.category === 'Live' || m.category === 'Pipeline');
    } else {
      result = result.filter((m) => m.category === categoryFilter);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.matter_name.toLowerCase().includes(searchLower) ||
          m.matter_number.toLowerCase().includes(searchLower) ||
          m.clients?.name.toLowerCase().includes(searchLower) ||
          m.clients?.display_name?.toLowerCase().includes(searchLower) ||
          m.lead_partner?.toLowerCase().includes(searchLower) ||
          m.originator?.toLowerCase().includes(searchLower) ||
          m.practice_area?.toLowerCase().includes(searchLower)
      );
    }

    // Client filter - check both primary client and secondary clients (for multi-client matters)
    if (clientFilter !== 'all') {
      result = result.filter((m) => {
        // Check primary client
        if (m.client_id === clientFilter) return true;
        // Check secondary clients from matter_clients table
        const secondaryClients = matterToClientsMap[m.id] || [];
        return secondaryClients.includes(clientFilter);
      });
    }

    // Practice area filter - if any are selected, filter to those
    if (practiceAreaFilter.length > 0) {
      result = result.filter((m) => {
        if (!m.practice_area) return false;
        return practiceAreaFilter.includes(m.practice_area.trim());
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'matter_name':
          // Sort by "Client Name - Matter Name" combined for alphabetical ordering
          const aClient = ((a as any).clients?.display_name || (a as any).clients?.name || '').toLowerCase();
          const bClient = ((b as any).clients?.display_name || (b as any).clients?.name || '').toLowerCase();
          aVal = `${aClient} - ${a.matter_name.toLowerCase()}`;
          bVal = `${bClient} - ${b.matter_name.toLowerCase()}`;
          break;
        case 'fee_amount':
          aVal = a.fee_amount_upper_end || 0;
          bVal = b.fee_amount_upper_end || 0;
          break;
        case 'headroom':
          // Sort by headroom percentage (high to low by default)
          aVal = a.headroom_percent || 0;
          bVal = b.headroom_percent || 0;
          break;
        case 'headroom_pct':
          aVal = a.headroom_percent || 0;
          bVal = b.headroom_percent || 0;
          break;
        case 'wip':
          aVal = a.latest_snapshot?.wip_amount || 0;
          bVal = b.latest_snapshot?.wip_amount || 0;
          break;
        case 'ar':
          aVal = a.latest_snapshot?.accounts_receivable || 0;
          bVal = b.latest_snapshot?.accounts_receivable || 0;
          break;
        case 'paid':
          aVal = a.latest_snapshot?.paid_amount || 0;
          bVal = b.latest_snapshot?.paid_amount || 0;
          break;
        case 'budget_burn':
          // Budget burn = WIP + AR + Paid (each value is mutually exclusive)
          aVal = (a.latest_snapshot?.wip_amount || 0) + (a.latest_snapshot?.accounts_receivable || 0) + (a.latest_snapshot?.paid_amount || 0);
          bVal = (b.latest_snapshot?.wip_amount || 0) + (b.latest_snapshot?.accounts_receivable || 0) + (b.latest_snapshot?.paid_amount || 0);
          break;
        case 'budget_burn_pct':
          // Sort by BM burn percentage (100 - bm_headroom_percent) - higher burn first
          aVal = 100 - ((a as any).bm_headroom_percent || 0);
          bVal = 100 - ((b as any).bm_headroom_percent || 0);
          break;
        case 'local_burn_pct':
          // Sort by LC burn percentage (100 - lc_headroom_percent) - higher burn first
          aVal = 100 - ((a as any).lc_headroom_percent || 0);
          bVal = 100 - ((b as any).lc_headroom_percent || 0);
          break;
        case 'local_counsel':
          aVal = a.local_counsel_fee || 0;
          bVal = b.local_counsel_fee || 0;
          break;
        case 'bm_fee':
          // Sort by USD equivalent value
          const aFeeCurrency = a.fee_currency || 'GBP';
          const bFeeCurrency = b.fee_currency || 'GBP';
          const aExchangeRate = a.exchange_rate || 1;
          const bExchangeRate = b.exchange_rate || 1;
          const aBmFee = a.bm_fee_component || 0;
          const bBmFee = b.bm_fee_component || 0;
          aVal = convertToUsd(aBmFee, aFeeCurrency, aExchangeRate, gbpToUsdRate, liveRates);
          bVal = convertToUsd(bBmFee, bFeeCurrency, bExchangeRate, gbpToUsdRate, liveRates);
          break;
        case 'stage':
          aVal = a.current_stage || '';
          bVal = b.current_stage || '';
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [matters, search, tabFilter, categoryFilter, clientFilter, practiceAreaFilter, sortField, sortDirection, matterToClientsMap, gbpToUsdRate, liveRates]);

  const categoryCounts = useMemo(() => {
    const counts: Record<MatterCategory, number> = { Live: 0, Pipeline: 0, Closed: 0, Lost: 0 };
    matters.forEach(m => {
      if (counts[m.category] !== undefined) {
        counts[m.category]++;
      }
    });
    return counts;
  }, [matters]);

  // Count for MMA/BP tab (Live + Pipeline)
  const mmaBpCount = useMemo(() => {
    return matters.filter(m => m.category === 'Live' || m.category === 'Pipeline').length;
  }, [matters]);

  const categoryTotals = useMemo(() => {
    return filteredMatters.reduce((sum, m) => {
      const feeCurrency = m.fee_currency || 'GBP';
      const exchangeRate = m.exchange_rate || 1;
      const bmFee = m.bm_fee_component || 0;
      return sum + convertToUsd(bmFee, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
    }, 0);
  }, [filteredMatters, gbpToUsdRate, liveRates]);

  const closedFeesPaid = useMemo(() => {
    if (categoryFilter !== 'Closed') return 0;
    return filteredMatters.reduce((sum, m) => {
      const feeCurrency = m.fee_currency || 'GBP';
      const exchangeRate = m.exchange_rate || 1;
      const paidAmount = m.latest_snapshot?.paid_amount || 0;
      return sum + convertToUsd(paidAmount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
    }, 0);
  }, [filteredMatters, categoryFilter, gbpToUsdRate, liveRates]);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={cn(
        "h-4 w-4",
        sortField === field ? "text-primary" : "text-muted-foreground"
      )} />
    </button>
  );

  const getHeadroomStatus = (matter: MatterWithFinancials) => {
    const pct = matter.headroom_percent || 0;
    if (pct < 0) return 'danger';
    if (pct < 20) return 'warning';
    return 'success';
  };

  const isMmaBpTab = tabFilter === 'MMA/BP';
  const isClientsTab = tabFilter === 'Clients';
  const isSpecialTab = isMmaBpTab || isClientsTab;
  const isPipeline = categoryFilter === 'Pipeline';
  const isLive = categoryFilter === 'Live';
  const isLost = categoryFilter === 'Lost';
  const isClosed = categoryFilter === 'Closed';
  const isPipelineOrLost = isPipeline || isLost;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Matters</h1>
            <p className="text-muted-foreground mt-1">Track live transactions, pipeline, and closed matters</p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowMasterWipHistoryDialog(true)}
                    size="sm"
                  >
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={() => setShowMasterWipDialog(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Master Financial Snapshot Update
                  </Button>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Checkbox
                    id="highlight-movements-master"
                    checked={masterHighlightEnabled}
                    onCheckedChange={(checked) => toggleMasterHighlight(!!checked)}
                    className="h-4 w-4"
                  />
                  <label 
                    htmlFor="highlight-movements-master" 
                    className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    Highlight Recent Movements
                  </label>
                </div>
              </div>
            )}
            {!isClosed && !isSpecialTab && (
              <Button asChild>
                <Link to="/matters/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Matter
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={tabFilter} onValueChange={(v) => setTabFilter(v as TabFilter)}>
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            {(['Live', 'Pipeline', 'Closed', 'Lost'] as MatterCategory[]).map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-2">
                {categoryIcons[cat]}
                <span>{cat}</span>
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {categoryCounts[cat]}
                </span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="MMA/BP" className="gap-2 bg-stone-100 dark:bg-stone-800/50 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-900/30 dark:data-[state=active]:text-amber-200">
              <Users className="h-4 w-4" />
              <span>MMA/BP</span>
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {mmaBpCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="Clients" className="gap-2 bg-stone-100 dark:bg-stone-800/50 data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 dark:data-[state=active]:bg-emerald-900/30 dark:data-[state=active]:text-emerald-200">
              <Building2 className="h-4 w-4" />
              <span>Clients</span>
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {clients.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary & Filters - Hide for Clients tab */}
        {!isClientsTab && (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search matters, clients, partners..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {getClientDisplayName(client)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Practice Area Multi-Select Filter */}
                  {uniquePracticeAreas.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full sm:w-48 justify-between",
                            practiceAreaFilter.length > 0 && "border-primary"
                          )}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Filter className="h-4 w-4 shrink-0" />
                            {practiceAreaFilter.length === 0 
                              ? "All Practices" 
                              : practiceAreaFilter.length === 1 
                                ? practiceAreaFilter[0]
                                : `${practiceAreaFilter.length} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-56 p-0 bg-background border shadow-lg z-50" 
                        align="start"
                      >
                        <div className="p-2 border-b">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Practice Areas</span>
                            {practiceAreaFilter.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setPracticeAreaFilter([])}
                              >
                                Clear
                                <X className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                          {uniquePracticeAreas.map((area) => (
                            <label
                              key={area}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={practiceAreaFilter.includes(area)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setPracticeAreaFilter([...practiceAreaFilter, area]);
                                  } else {
                                    setPracticeAreaFilter(practiceAreaFilter.filter(a => a !== area));
                                  }
                                }}
                              />
                              <span className="text-sm">{area}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global WIP Proposal Toggle - only for Live tab when there are proposals */}
        {categoryFilter === 'Live' && mattersWithProposals.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Checkbox
              id="toggle-all-proposals"
              checked={allProposalsApplied}
              onCheckedChange={(checked) => toggleAllProposals(!!checked)}
              disabled={isTogglingProposals}
              className="h-5 w-5"
            />
            <label 
              htmlFor="toggle-all-proposals" 
              className="text-sm font-medium text-amber-800 dark:text-amber-200 cursor-pointer flex items-center gap-2"
            >
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Apply All WIP Proposals ({mattersWithProposals.length} matter{mattersWithProposals.length !== 1 ? 's' : ''})
              {isTogglingProposals && <Loader2 className="h-4 w-4 animate-spin" />}
            </label>
          </div>
        )}

        {/* Clients Tab Content */}
        {isClientsTab && (
          <ClientsTabContent 
            clients={clients} 
            clientsInUse={clientsInUse}
            isLoading={clientsLoading} 
            updateClient={updateClient}
            deleteClient={deleteClient}
          />
        )}

        {/* Table - Hide for Clients tab */}
        {!isClientsTab && (
          <Card className="shadow-card">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMatters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-foreground">
                    No {isMmaBpTab ? 'live or pipeline' : categoryFilter?.toLowerCase()} matters found
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search || clientFilter !== 'all'
                      ? 'Try adjusting your filters'
                      : isMmaBpTab ? 'No live or pipeline matters to assign' : `Get started by creating a new ${categoryFilter?.toLowerCase()} matter`}
                  </p>
                  {!search && clientFilter === 'all' && !isClosed && !isMmaBpTab && (
                    <Button asChild className="mt-4">
                      <Link to="/matters/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Matter
                      </Link>
                    </Button>
                  )}
                </div>
              ) : isMmaBpTab ? (
              /* MMA/BP Tab Table */
              <StickyTableHeader>
                <TableScrollControls>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="min-w-[200px] sticky left-0 z-20 bg-background">
                          <SortableHeader field="matter_name">Client / Matter</SortableHeader>
                        </TableHead>
                        <TableHead className="min-w-[80px]">Category</TableHead>
                        <TableHead className="min-w-[200px]">Billing Partner</TableHead>
                        <TableHead className="min-w-[200px]">MMA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatters
                        .sort((a, b) => {
                          // Sort by category (Live first), then by client name, then by matter name
                          if (a.category !== b.category) {
                            return a.category === 'Live' ? -1 : 1;
                          }
                          const clientCompare = (a.clients?.name || '').localeCompare(b.clients?.name || '');
                          if (clientCompare !== 0) return clientCompare;
                          return a.matter_name.localeCompare(b.matter_name);
                        })
                        .map((matter) => (
                          <MmaBpTableRow
                            key={matter.id}
                            matter={matter}
                            userProfile={userProfile}
                            updateMatter={updateMatter}
                          />
                        ))}
                    </TableBody>
                  </Table>
                </TableScrollControls>
              </StickyTableHeader>
            ) : (
              <>
                {/* Health warning for Live tab - financial data source notice */}
                {isLive && (
                  <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Budget burn figures use Financial Snapshot data only
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                        For detailed line-item Budget usage tracking, view individual matter budgets.
                      </p>
                    </div>
                  </div>
                )}
                <StickyTableHeader>
                <TableScrollControls>
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[140px] sticky left-0 z-20 bg-background">
                        <SortableHeader field="matter_name">Client / Matter</SortableHeader>
                      </TableHead>
                      {isLive && (
                        <>
                          <TableHead className="text-right min-w-[110px]">
                            Financials
                          </TableHead>
                          <TableHead className="text-right min-w-[75px]">
                            <SortableHeader field="budget_burn_pct">BM Burn</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right min-w-[75px]">
                            <SortableHeader field="local_burn_pct">Local Burn</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right min-w-[80px]">
                            <SortableHeader field="headroom">Headroom (BM + Local)</SortableHeader>
                          </TableHead>
                        </>
                      )}
                      <TableHead className="text-right min-w-[90px]">
                        <SortableHeader field="fee_amount">Budget</SortableHeader>
                      </TableHead>
                      {isPipelineOrLost && (
                        <TableHead className="text-right min-w-[80px]">USD</TableHead>
                      )}
                      {isLive && (
                        <>
                          <TableHead className="text-right min-w-[85px]">
                            <SortableHeader field="bm_fee">BM Budget</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right min-w-[95px]">
                            <SortableHeader field="local_counsel">Local Budget</SortableHeader>
                          </TableHead>
                        </>
                      )}
                      {isPipelineOrLost && (
                        <TableHead className="min-w-[70px]">Source</TableHead>
                      )}
                      {isPipeline && (
                        <>
                          <TableHead className="min-w-[75px]">Clarif.</TableHead>
                          <TableHead className="min-w-[75px]">Submit</TableHead>
                          <TableHead className="min-w-[70px]">Decision</TableHead>
                          <TableHead className="min-w-[60px]">Sent</TableHead>
                          <TableHead className="min-w-[65px]">Outcome</TableHead>
                        </>
                      )}
                      {isLive && (
                        <TableHead className="min-w-[90px]">
                          <SortableHeader field="stage">Stage</SortableHeader>
                        </TableHead>
                      )}
                      <TableHead className="min-w-[70px]">Practice</TableHead>
                      {!isPipelineOrLost && (
                        <TableHead className="w-16">Status</TableHead>
                      )}
                      <TableHead className="w-12 min-w-[48px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatters.map((matter) => {
                      const headroomStatus = getHeadroomStatus(matter);
                      // Budget burn = WIP + AR + Paid (each value is mutually exclusive)
                      const budgetBurn = (matter.latest_snapshot?.wip_amount || 0) + (matter.latest_snapshot?.accounts_receivable || 0) + (matter.latest_snapshot?.paid_amount || 0);
                      
                      // Get fee type label for display
                      const getFeeTypeLabel = (feeType: string | null) => {
                        if (!feeType) return null;
                        if (feeType.includes('Cap')) return 'Cap';
                        if (feeType.includes('Estimate')) return 'Estimate';
                        return feeType;
                      };
                      
                      // Determine display status: Open if all 3 checkboxes true, ATTN otherwise
                      const displayStatus = matter.aml_kyc_complete && matter.assignment_letter_signed && matter.matter_open
                        ? 'Open'
                        : 'ATTN';
                      
                      return (
                        <TableRow key={matter.id} className="group">
                          <TableCell className="sticky left-0 z-10 bg-background max-w-[200px]">
                            <Link 
                              to={`/matters/${matter.id}`}
                              className="block hover:text-primary transition-colors"
                            >
                              <p className="font-medium text-foreground">{getClientDisplayName(matter.clients)}</p>
                              <p className="text-sm text-muted-foreground group-hover:text-primary transition-colors line-clamp-2" title={matter.matter_name}>
                                {(matter as any).matter_display_name || matter.matter_name}
                              </p>
                            </Link>
                            {(matter as any).show_shaping_proposal && (matter as any).selected_proposal && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" />
                                  Showing WIP Proposal
                                </span>
                              </div>
                            )}
                          </TableCell>
                          {isLive && (
                            <>
                              <TableCell className={cn(
                                "p-1",
                                (matter as any).show_shaping_proposal && (matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
                              )}>
                                {(() => {
                                  const changeData = masterChangesMap.get(matter.id);
                                  const currency = (matter as any).effective_currency ?? matter.fee_currency;
                                  const currentWip = matter.latest_snapshot?.wip_amount || 0;
                                  const currentAr = matter.latest_snapshot?.accounts_receivable || 0;
                                  const currentPaid = matter.latest_snapshot?.paid_amount || 0;
                                  const currentWriteOff = matter.latest_snapshot?.wip_write_off_amount || 0;
                                  
                                  // Check if values changed (only if highlighting is enabled and we have change data)
                                  const wipChanged = masterHighlightEnabled && changeData && currentWip !== changeData.before_wip_amount;
                                  const arChanged = masterHighlightEnabled && changeData && currentAr !== changeData.before_accounts_receivable;
                                  const paidChanged = masterHighlightEnabled && changeData && currentPaid !== changeData.before_paid_amount;
                                  const writeOffChanged = masterHighlightEnabled && changeData && currentWriteOff !== changeData.before_wip_write_off_amount;
                                  
                                  return (
                                    <div className="flex flex-col gap-0.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-muted-foreground leading-tight">BM WIP:</span>
                                        <HighlightedFinancialValue
                                          currentValue={formatCurrency(currentWip, currency)}
                                          previousValue={changeData?.before_wip_amount}
                                          previousDate={changeData?.created_at}
                                          isHighlighted={!!wipChanged}
                                          className="text-xs font-medium"
                                          formatFn={(v) => formatCurrency(v, currency)}
                                        />
                                      </div>
                                      {/* Show write-off amount in red if present */}
                                      {currentWriteOff > 0 && (
                                        <div className="flex items-center justify-end gap-1">
                                          <HighlightedFinancialValue
                                            currentValue={`W/O: ${formatCurrency(currentWriteOff, currency)}`}
                                            previousValue={changeData?.before_wip_write_off_amount}
                                            previousDate={changeData?.created_at}
                                            isHighlighted={!!writeOffChanged}
                                            className="text-[9px] text-destructive leading-tight"
                                            formatFn={(v) => formatCurrency(v, currency)}
                                          />
                                        </div>
                                      )}
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-muted-foreground leading-tight">AR:</span>
                                        <HighlightedFinancialValue
                                          currentValue={formatCurrency(currentAr, currency)}
                                          previousValue={changeData?.before_accounts_receivable}
                                          previousDate={changeData?.created_at}
                                          isHighlighted={!!arChanged}
                                          className="text-xs font-medium"
                                          formatFn={(v) => formatCurrency(v, currency)}
                                        />
                                      </div>
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-[10px] text-muted-foreground leading-tight">Paid:</span>
                                        <HighlightedFinancialValue
                                          currentValue={formatCurrency(currentPaid, currency)}
                                          previousValue={changeData?.before_paid_amount}
                                          previousDate={changeData?.created_at}
                                          isHighlighted={!!paidChanged}
                                          className="text-xs font-medium text-success"
                                          formatFn={(v) => formatCurrency(v, currency)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right",
                                (matter as any).show_shaping_proposal && (matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
                              )}>
                                <div className="flex flex-col items-end">
                                  <span className="text-muted-foreground">
                                    {formatCurrency(budgetBurn, (matter as any).effective_currency ?? matter.fee_currency)}
                                  </span>
                                  <span className={cn(
                                    "text-[10px]",
                                    (100 - ((matter as any).bm_headroom_percent || 0)) > 100 ? "text-danger" :
                                    (100 - ((matter as any).bm_headroom_percent || 0)) > 80 ? "text-warning" : "text-success"
                                  )}>
                                    {(100 - ((matter as any).bm_headroom_percent || 0)).toFixed(0)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className={cn(
                                "text-right",
                                (matter as any).show_shaping_proposal && (matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
                              )}>
                                {matter.local_counsel_billing === 'Disb' && matter.local_counsel_fee > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-muted-foreground">
                                      {formatCurrency(((matter as any).lc_wip || 0) + ((matter as any).lc_billed || 0), (matter as any).effective_currency ?? matter.fee_currency)}
                                    </span>
                                    <span className={cn(
                                      "text-[10px]",
                                      (100 - ((matter as any).lc_headroom_percent || 0)) > 100 ? "text-danger" :
                                      (100 - ((matter as any).lc_headroom_percent || 0)) > 80 ? "text-warning" : "text-success"
                                    )}>
                                      {(100 - ((matter as any).lc_headroom_percent || 0)).toFixed(0)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/50">-</span>
                                )}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right",
                                (matter as any).show_shaping_proposal && (matter as any).selected_proposal && "bg-amber-50 dark:bg-amber-900/20"
                              )}>
                                {(matter as any).pay_full_time_costs ? (
                                  <span className="text-muted-foreground">N/A</span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className={cn(
                                      "font-medium",
                                      matter.headroom < 0 ? "text-danger" : "text-foreground"
                                    )}>
                                      {formatCurrency(matter.headroom, (matter as any).effective_currency ?? matter.fee_currency)}
                                    </span>
                                    <span className={cn(
                                      "text-[10px]",
                                      headroomStatus === 'danger' && 'text-danger',
                                      headroomStatus === 'warning' && 'text-warning',
                                      headroomStatus === 'success' && 'text-success'
                                    )}>
                                      {matter.headroom_percent.toFixed(0)}%
                                    </span>
                                  </div>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-right">
                            {(matter as any).pay_full_time_costs ? (
                              <span className="text-muted-foreground">N/A</span>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5">
                                {matter.fee_type && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {getFeeTypeLabel(matter.fee_type)}
                                  </span>
                                )}
                                <span className="font-medium">
                                  {formatCurrency((matter as any).effective_fee_upper_end ?? matter.fee_amount_upper_end, (matter as any).effective_currency ?? matter.fee_currency)}
                                </span>
                                {(matter as any).different_billing_currency && (matter as any).agreed_billing_amount > 0 && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    (quoted: {formatCurrency(matter.fee_amount_upper_end, (matter as any).quote_currency)})
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          {isPipelineOrLost && (
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-muted-foreground">
                                  {formatCurrency((matter as any).effective_bm_fee ?? matter.bm_fee_component, (matter as any).effective_currency ?? matter.fee_currency)}
                                </span>
                                {!(matter as any).different_billing_currency && matter.fee_currency !== 'USD' && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertToUsd(matter.bm_fee_component, matter.fee_currency || 'GBP', matter.exchange_rate || 1, gbpToUsdRate, liveRates))}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {isLive && (
                            <>
                              <TableCell className="text-right font-medium">
                                {(matter as any).pay_full_time_costs ? (
                                  <span className="text-muted-foreground font-normal">N/A</span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span>{formatCurrency((matter as any).effective_bm_fee ?? matter.bm_fee_component, (matter as any).effective_currency ?? matter.fee_currency)}</span>
                                    {/* Always show USD equivalent for non-USD currencies */}
                                    {((matter as any).effective_currency ?? matter.fee_currency) !== 'USD' && (
                                      <span className="text-[10px] text-muted-foreground/70 font-normal">
                                        ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(convertToUsd((matter as any).effective_bm_fee ?? matter.bm_fee_component, (matter as any).effective_currency ?? matter.fee_currency ?? 'GBP', matter.exchange_rate || 1, gbpToUsdRate, liveRates))}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {(matter as any).pay_full_time_costs ? (
                                  <span className="text-muted-foreground">N/A</span>
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-muted-foreground">
                                      {formatCurrency((matter as any).effective_local_counsel_fee ?? matter.local_counsel_fee, (matter as any).effective_currency ?? matter.fee_currency)}
                                    </span>
                                    {/* Per-LC billing mode checkboxes */}
                                    {((matter as any).local_counsels && (matter as any).local_counsels.length > 0) ? (
                                      <div className="flex flex-col gap-1 items-end">
                                        {(matter as any).local_counsels.map((lc: any) => {
                                          const hasSelection = lc.billing_mode === 'Disb' || lc.billing_mode === 'Direct';
                                          return (
                                            <div key={lc.id} className="flex items-center gap-1">
                                              <span className={cn(
                                                "text-[8px] leading-none truncate max-w-[60px]",
                                                hasSelection ? "text-muted-foreground" : "text-destructive"
                                              )} title={lc.firm_name}>
                                                {lc.firm_name.length > 10 ? lc.firm_name.slice(0, 10) + '…' : lc.firm_name}
                                              </span>
                                              <label 
                                                className={cn(
                                                  "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                                                  hasSelection ? "text-success" : "text-destructive"
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={lc.billing_mode === 'Disb'}
                                                  onChange={async () => {
                                                    const newValue = lc.billing_mode === 'Disb' ? null : 'Disb';
                                                    await updateLcBillingMode(lc.id, newValue);
                                                  }}
                                                  className={cn(
                                                    "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                                                    lc.billing_mode === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                                  )}
                                                />
                                                D
                                              </label>
                                              <label 
                                                className={cn(
                                                  "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                                                  hasSelection ? "text-success" : "text-destructive"
                                                )}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={lc.billing_mode === 'Direct'}
                                                  onChange={async () => {
                                                    const newValue = lc.billing_mode === 'Direct' ? null : 'Direct';
                                                    await updateLcBillingMode(lc.id, newValue);
                                                  }}
                                                  className={cn(
                                                    "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                                                    lc.billing_mode === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                                  )}
                                                />
                                                Dir
                                              </label>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (matter.local_counsel_fee || 0) > 0 && (
                                      /* Fallback to matter-level checkboxes if no LC records exist */
                                      (() => {
                                        const hasSelection = matter.local_counsel_billing === 'Disb' || matter.local_counsel_billing === 'Direct';
                                        return (
                                          <div className="flex items-center gap-1.5">
                                            <label 
                                              className={cn(
                                                "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                                                hasSelection ? "text-success" : "text-destructive"
                                              )}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={matter.local_counsel_billing === 'Disb'}
                                                onChange={async () => {
                                                  const newValue = matter.local_counsel_billing === 'Disb' ? null : 'Disb';
                                                  await updateLocalCounselBilling(matter.id, newValue);
                                                }}
                                                className={cn(
                                                  "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                                                  matter.local_counsel_billing === 'Disb' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                                )}
                                              />
                                              Disb
                                            </label>
                                            <label 
                                              className={cn(
                                                "flex items-center gap-0.5 cursor-pointer text-[9px] leading-none",
                                                hasSelection ? "text-success" : "text-destructive"
                                              )}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={matter.local_counsel_billing === 'Direct'}
                                                onChange={async () => {
                                                  const newValue = matter.local_counsel_billing === 'Direct' ? null : 'Direct';
                                                  await updateLocalCounselBilling(matter.id, newValue);
                                                }}
                                                className={cn(
                                                  "h-2.5 w-2.5 rounded-sm border cursor-pointer accent-current",
                                                  matter.local_counsel_billing === 'Direct' ? "border-success" : hasSelection ? "border-success" : "border-destructive"
                                                )}
                                              />
                                              Direct
                                            </label>
                                          </div>
                                        );
                                      })()
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            </>
                          )}
                          {isPipelineOrLost && (
                            <TableCell className="text-muted-foreground text-sm">
                              {matter.source || '-'}
                            </TableCell>
                          )}
                          {isPipeline && (
                            <>
                              <TableCell className="text-sm">
                                {matter.clarifications_date ? (
                                  <span className={cn(
                                    !matter.submitted && matter.clarifications_date && 
                                    differenceInDays(parseISO(matter.clarifications_date), new Date()) <= 3 &&
                                    differenceInDays(parseISO(matter.clarifications_date), new Date()) >= 0
                                      ? "text-warning font-medium"
                                      : "text-muted-foreground"
                                  )}>
                                    {format(parseISO(matter.clarifications_date), 'dd MMM yy')}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {matter.submission_deadline ? (() => {
                                  const deadlineDate = parseISO(matter.submission_deadline);
                                  const daysUntil = differenceInDays(deadlineDate, new Date());
                                  const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate);
                                  const isUrgent = !isOverdue && daysUntil <= 3;
                                  const needsAttention = !matter.submitted && (isOverdue || isUrgent);
                                  
                                  return (
                                    <div className="flex items-center gap-1">
                                      {needsAttention && (
                                        <AlertTriangle className={cn(
                                          "h-3.5 w-3.5",
                                          isOverdue ? "text-destructive" : "text-warning"
                                        )} />
                                      )}
                                      <span className={cn(
                                        needsAttention && isOverdue && "text-destructive font-medium",
                                        needsAttention && isUrgent && !isOverdue && "text-warning font-medium",
                                        !needsAttention && "text-muted-foreground"
                                      )}>
                                        {format(deadlineDate, 'dd MMM yy')}
                                      </span>
                                    </div>
                                  );
                                })() : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {matter.decision_date ? format(parseISO(matter.decision_date), 'dd MMM yy') : '-'}
                              </TableCell>
                              <TableCell>
                                {matter.submitted ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Yes
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    <Clock className="h-3 w-3" />
                                    No
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {matter.pipeline_outcome ? (
                                  <span className={cn(
                                    "text-xs font-medium px-2 py-1 rounded",
                                    matter.pipeline_outcome === 'Won' && 'bg-green-100 text-green-700',
                                    matter.pipeline_outcome === 'Lost' && 'bg-red-100 text-red-700',
                                    matter.pipeline_outcome === 'Pending' && 'bg-amber-100 text-amber-700'
                                  )}>
                                    {matter.pipeline_outcome}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground bg-amber-100 text-amber-700 px-2 py-1 rounded">Pending</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          {isLive && (
                            <TableCell>
                              <Select
                                value={matter.current_stage || ''}
                                onValueChange={async (value) => {
                                  try {
                                    await updateMatter.mutateAsync({
                                      id: matter.id,
                                      current_stage: value as MatterStage,
                                    });
                                    toast.success('Stage updated');
                                  } catch (error) {
                                    toast.error('Failed to update stage');
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 w-[160px] text-sm">
                                  <SelectValue placeholder="Select stage" />
                                </SelectTrigger>
                                <SelectContent>
                                  {liveStages.map((stage) => (
                                    <SelectItem key={stage} value={stage}>
                                      {stage}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground text-sm">
                            {matter.practice_area || '-'}
                          </TableCell>
                          {!isPipelineOrLost && (
                            <TableCell>
                              <StatusBadge status={displayStatus} />
                            </TableCell>
                          )}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {getCategoryActions(matter).map((action) => (
                                  <DropdownMenuItem
                                    key={action.label}
                                    onClick={() => handleCategoryChange(matter.id, action.category, action.outcome)}
                                    className="cursor-pointer"
                                  >
                                    <ArrowRightCircle className="mr-2 h-4 w-4" />
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScrollControls>
            </StickyTableHeader>
              </>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* Master WIP Update Dialog */}
      <MasterWipUpdateDialog
        isOpen={showMasterWipDialog}
        onClose={() => setShowMasterWipDialog(false)}
        matters={matters.filter(m => m.category === 'Live')}
        onApplyUpdates={async (updates, lcAllocations) => {
          const today = new Date().toISOString().split('T')[0];
          const snapshotChanges: Array<{
            matter_id: string;
            snapshot_id: string | null;
            was_new_snapshot: boolean;
            before_wip_amount: number;
            before_billed_amount: number;
            before_paid_amount: number;
            before_accounts_receivable: number;
            before_wip_write_off_amount: number;
          }> = [];

          for (const update of updates) {
            // Get the current snapshot to track "before" values
            const matter = matters.find(m => m.id === update.matter_id);
            const currentSnapshot = matter?.latest_snapshot;
            
            // Check if there's already a snapshot for today
            const { data: existingTodaySnapshot } = await supabase
              .from('financial_snapshots')
              .select('*')
              .eq('matter_id', update.matter_id)
              .eq('as_of_date', today)
              .maybeSingle();

            // Track the before state
            snapshotChanges.push({
              matter_id: update.matter_id,
              snapshot_id: null, // Will be updated after upsert
              was_new_snapshot: !existingTodaySnapshot,
              before_wip_amount: existingTodaySnapshot?.wip_amount ?? currentSnapshot?.wip_amount ?? 0,
              before_billed_amount: existingTodaySnapshot?.billed_amount ?? currentSnapshot?.billed_amount ?? 0,
              before_paid_amount: existingTodaySnapshot?.paid_amount ?? currentSnapshot?.paid_amount ?? 0,
              before_accounts_receivable: existingTodaySnapshot?.accounts_receivable ?? currentSnapshot?.accounts_receivable ?? 0,
              before_wip_write_off_amount: existingTodaySnapshot?.wip_write_off_amount ?? currentSnapshot?.wip_write_off_amount ?? 0,
            });

            // Apply the updates
            await upsertTodaySnapshot.mutateAsync({
              matterId: update.matter_id,
              field: 'wip_amount',
              value: update.wip_amount,
            });
            await upsertTodaySnapshot.mutateAsync({
              matterId: update.matter_id,
              field: 'wip_write_off_amount',
              value: update.wip_write_off_amount,
            });
            await upsertTodaySnapshot.mutateAsync({
              matterId: update.matter_id,
              field: 'billed_amount',
              value: update.billed_amount,
            });
            await upsertTodaySnapshot.mutateAsync({
              matterId: update.matter_id,
              field: 'accounts_receivable',
              value: update.accounts_receivable,
            });
            const result = await upsertTodaySnapshot.mutateAsync({
              matterId: update.matter_id,
              field: 'paid_amount',
              value: update.paid_amount,
            });

            // Update the snapshot_id in our tracking
            const idx = snapshotChanges.findIndex(c => c.matter_id === update.matter_id);
            if (idx >= 0 && result.data) {
              snapshotChanges[idx].snapshot_id = result.data.id;
            }
          }

          // Track LC changes for reverting later
          const lcChanges: Array<{
            matter_id: string;
            local_counsel_id: string;
            before_wip_amount: number;
            before_billed_amount: number;
          }> = [];

          // Apply local counsel allocations if provided and capture before values
          if (lcAllocations && lcAllocations.length > 0) {
            for (const allocation of lcAllocations) {
              if (!allocation.isLocalCounselFee || allocation.allocations.length === 0) continue;
              
              for (const lcAlloc of allocation.allocations) {
                // Fetch current LC values before updating
                const { data: currentLc } = await supabase
                  .from('matter_local_counsels')
                  .select('wip_amount, billed_amount')
                  .eq('id', lcAlloc.localCounselId)
                  .single();

                // Track the before state
                if (currentLc) {
                  lcChanges.push({
                    matter_id: allocation.matterId,
                    local_counsel_id: lcAlloc.localCounselId,
                    before_wip_amount: currentLc.wip_amount || 0,
                    before_billed_amount: currentLc.billed_amount || 0,
                  });
                }

                // Update the local counsel's WIP and billed amounts
                const { error } = await supabase
                  .from('matter_local_counsels')
                  .update({
                    wip_amount: lcAlloc.wipAmount,
                    billed_amount: lcAlloc.billedAmount,
                    wip_updated_at: new Date().toISOString(),
                    billed_updated_at: new Date().toISOString(),
                    update_source: 'bulk',
                    last_updated: new Date().toISOString(),
                  })
                  .eq('id', lcAlloc.localCounselId);

                if (error) {
                  console.error('Failed to update local counsel:', error);
                }
              }
            }
            
            // Invalidate local counsel queries
            queryClient.invalidateQueries({ queryKey: ['local-counsels'] });
            
            const lcCount = lcAllocations.filter(a => a.isLocalCounselFee && a.allocations.length > 0).length;
            if (lcCount > 0) {
              toast.success(`Updated local counsel data for ${lcCount} matter(s)`);
            }
          }

          // Save the changes to the tracking table (including LC changes)
          if (snapshotChanges.length > 0) {
            try {
              await createMasterUpdate.mutateAsync({ 
                updates: snapshotChanges,
                lcChanges: lcChanges.length > 0 ? lcChanges : undefined,
              });
            } catch (error) {
              console.error('Failed to save master update tracking:', error);
              // Don't throw - the updates were still applied successfully
            }
          }
        }}
      />

      {/* Master WIP History Dialog */}
      <MasterWipHistoryDialog
        isOpen={showMasterWipHistoryDialog}
        onClose={() => setShowMasterWipHistoryDialog(false)}
        matters={matters.map(m => ({ id: m.id, matter_name: m.matter_name, fee_currency: m.fee_currency }))}
      />
    </AppLayout>
  );
}