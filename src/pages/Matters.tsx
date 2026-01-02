import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EditableFinancialCell } from '@/components/matters/EditableFinancialCell';
import { Search, Plus, ArrowUpDown, Loader2, Briefcase, TrendingUp, CheckCircle2, XCircle, MoreHorizontal, ArrowRightCircle, AlertTriangle, Clock } from 'lucide-react';
import { format, differenceInDays, parseISO, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currencyUtils';

type SortField = 'matter_name' | 'fee_amount' | 'bm_fee' | 'headroom' | 'headroom_pct' | 'wip' | 'ar' | 'paid' | 'budget_burn' | 'local_counsel' | 'stage';
type SortDirection = 'asc' | 'desc';

// Stage options based on category
const liveStages: MatterStage[] = ['Pre-Start', 'Term Sheet', 'Documentation - Start', 'Documentation - Close', 'Closing Process', 'Closed', 'Paused'];
const pipelineStages: MatterStage[] = ['Pending', 'Won', 'Lost'];

const categoryIcons: Record<MatterCategory, React.ReactNode> = {
  Live: <Briefcase className="h-4 w-4" />,
  Pipeline: <TrendingUp className="h-4 w-4" />,
  Closed: <CheckCircle2 className="h-4 w-4" />,
  Lost: <XCircle className="h-4 w-4" />,
};

export default function Matters() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { matters, isLoading, updateMatter } = useMatters();
  const { clients } = useClients();
  const { upsertTodaySnapshot } = useSnapshots();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MatterCategory>('Live');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('matter_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  // Silent update for local counsel billing (no toast)
  const updateLocalCounselBilling = async (matterId: string, value: 'Direct' | 'Disb' | null) => {
    await supabase.from('matters').update({ local_counsel_billing: value }).eq('id', matterId);
    queryClient.invalidateQueries({ queryKey: ['matters'] });
  };

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

  const filteredMatters = useMemo(() => {
    let result = [...matters];

    // Category filter
    result = result.filter((m) => m.category === categoryFilter);

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.matter_name.toLowerCase().includes(searchLower) ||
          m.matter_number.toLowerCase().includes(searchLower) ||
          m.clients?.name.toLowerCase().includes(searchLower) ||
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

    // Sort
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'matter_name':
          aVal = a.matter_name.toLowerCase();
          bVal = b.matter_name.toLowerCase();
          break;
        case 'fee_amount':
          aVal = a.fee_amount_upper_end || 0;
          bVal = b.fee_amount_upper_end || 0;
          break;
        case 'headroom':
          aVal = a.headroom || 0;
          bVal = b.headroom || 0;
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
          aVal = a.latest_snapshot?.billed_amount || 0;
          bVal = b.latest_snapshot?.billed_amount || 0;
          break;
        case 'paid':
          aVal = a.latest_snapshot?.paid_amount || 0;
          bVal = b.latest_snapshot?.paid_amount || 0;
          break;
        case 'budget_burn':
          // Budget burn = WIP + Billed only (paid is a subset of billed, not additional spend)
          aVal = (a.latest_snapshot?.wip_amount || 0) + (a.latest_snapshot?.billed_amount || 0);
          bVal = (b.latest_snapshot?.wip_amount || 0) + (b.latest_snapshot?.billed_amount || 0);
          break;
        case 'local_counsel':
          aVal = a.local_counsel_fee || 0;
          bVal = b.local_counsel_fee || 0;
          break;
        case 'bm_fee':
          aVal = a.bm_fee_component || 0;
          bVal = b.bm_fee_component || 0;
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
  }, [matters, search, categoryFilter, clientFilter, sortField, sortDirection, matterToClientsMap]);

  const categoryCounts = useMemo(() => {
    const counts: Record<MatterCategory, number> = { Live: 0, Pipeline: 0, Closed: 0, Lost: 0 };
    matters.forEach(m => {
      if (counts[m.category] !== undefined) {
        counts[m.category]++;
      }
    });
    return counts;
  }, [matters]);

  const categoryTotals = useMemo(() => {
    return filteredMatters.reduce((sum, m) => sum + (m.bm_fee_component || 0) * (m.exchange_rate || 1), 0);
  }, [filteredMatters]);

  const closedFeesPaid = useMemo(() => {
    if (categoryFilter !== 'Closed') return 0;
    return filteredMatters.reduce((sum, m) => sum + (m.latest_snapshot?.paid_amount || 0) * (m.exchange_rate || 1), 0);
  }, [filteredMatters, categoryFilter]);

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
          {!isClosed && (
            <Button asChild>
              <Link to="/matters/new">
                <Plus className="mr-2 h-4 w-4" />
                New Matter
              </Link>
            </Button>
          )}
        </div>

        {/* Category Tabs */}
        <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as MatterCategory)}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            {(['Live', 'Pipeline', 'Closed', 'Lost'] as MatterCategory[]).map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-2">
                {categoryIcons[cat]}
                <span>{cat}</span>
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {categoryCounts[cat]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Summary & Filters */}
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
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMatters.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No {categoryFilter.toLowerCase()} matters found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || clientFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : `Get started by creating a new ${categoryFilter.toLowerCase()} matter`}
                </p>
                {!search && clientFilter === 'all' && !isClosed && (
                  <Button asChild className="mt-4">
                    <Link to="/matters/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Matter
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <StickyTableHeader>
                <TableScrollControls>
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[140px] sticky left-0 z-20 bg-background">
                        <SortableHeader field="matter_name">Client / Matter</SortableHeader>
                      </TableHead>
                      {!isPipelineOrLost && (
                        <TableHead className="w-16">Status</TableHead>
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
                          <TableHead className="text-right min-w-[110px]">
                            Financials
                          </TableHead>
                          <TableHead className="text-right min-w-[75px]">
                            <SortableHeader field="budget_burn">BM Burn</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right min-w-[75px]">
                            Local Burn
                          </TableHead>
                          <TableHead className="text-right min-w-[80px]">
                            <SortableHeader field="headroom">Headroom</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right min-w-[45px]">
                            <SortableHeader field="headroom_pct">%</SortableHeader>
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
                      {!isLost && (
                        <TableHead className="min-w-[90px]">
                          <SortableHeader field="stage">Stage</SortableHeader>
                        </TableHead>
                      )}
                      <TableHead className="min-w-[70px]">Practice</TableHead>
                      <TableHead className="w-12 min-w-[48px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatters.map((matter) => {
                      const headroomStatus = getHeadroomStatus(matter);
                      // Budget burn = WIP + Billed only (paid is a subset of billed)
                      const budgetBurn = (matter.latest_snapshot?.wip_amount || 0) + 
                                        (matter.latest_snapshot?.billed_amount || 0);
                      
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
                          <TableCell className="sticky left-0 z-10 bg-background">
                            <Link 
                              to={`/matters/${matter.id}`}
                              className="block hover:text-primary transition-colors"
                            >
                              <p className="text-sm text-muted-foreground">{matter.clients?.name}</p>
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {matter.matter_name}
                              </p>
                            </Link>
                          </TableCell>
                          {!isPipelineOrLost && (
                            <TableCell>
                              <StatusBadge status={displayStatus} />
                            </TableCell>
                          )}
                          <TableCell className="text-right">
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
                          </TableCell>
                          {isPipelineOrLost && (
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-muted-foreground">
                                  {formatCurrency((matter as any).effective_bm_fee ?? matter.bm_fee_component, (matter as any).effective_currency ?? matter.fee_currency)}
                                </span>
                                {!(matter as any).different_billing_currency && matter.fee_currency !== 'USD' && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(matter.bm_fee_component * (matter.exchange_rate || 1))}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {isLive && (
                            <>
                              <TableCell className="text-right font-medium">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency((matter as any).effective_bm_fee ?? matter.bm_fee_component, (matter as any).effective_currency ?? matter.fee_currency)}</span>
                                  {/* Always show USD equivalent for non-USD currencies */}
                                  {((matter as any).effective_currency ?? matter.fee_currency) !== 'USD' && (
                                    <span className="text-[10px] text-muted-foreground/70 font-normal">
                                      ≈ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(((matter as any).effective_bm_fee ?? matter.bm_fee_component) * (matter.exchange_rate || 1))}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-muted-foreground">
                                    {formatCurrency((matter as any).effective_local_counsel_fee ?? matter.local_counsel_fee, (matter as any).effective_currency ?? matter.fee_currency)}
                                  </span>
                                  {(matter.local_counsel_fee || 0) > 0 && (() => {
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
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="p-1">
                                <div className="flex flex-col gap-0.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-[10px] text-muted-foreground leading-tight">WIP:</span>
                                    <EditableFinancialCell
                                      value={matter.latest_snapshot?.wip_amount || 0}
                                      currency={matter.fee_currency}
                                      compact
                                      onSave={async (value) => {
                                        await upsertTodaySnapshot.mutateAsync({
                                          matterId: matter.id,
                                          field: 'wip_amount',
                                          value,
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-[10px] text-muted-foreground leading-tight">Billed:</span>
                                    <EditableFinancialCell
                                      value={matter.latest_snapshot?.billed_amount || 0}
                                      currency={matter.fee_currency}
                                      compact
                                      onSave={async (value) => {
                                        await upsertTodaySnapshot.mutateAsync({
                                          matterId: matter.id,
                                          field: 'billed_amount',
                                          value,
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-[10px] text-muted-foreground leading-tight">Paid:</span>
                                    <EditableFinancialCell
                                      value={matter.latest_snapshot?.paid_amount || 0}
                                      currency={matter.fee_currency}
                                      compact
                                      onSave={async (value) => {
                                        await upsertTodaySnapshot.mutateAsync({
                                          matterId: matter.id,
                                          field: 'paid_amount',
                                          value,
                                        });
                                      }}
                                      className="text-success"
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(budgetBurn, (matter as any).effective_currency ?? matter.fee_currency)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {matter.local_counsel_billing === 'Disb' && matter.local_counsel_fee > 0 ? (
                                  formatCurrency(((matter as any).lc_wip || 0) + ((matter as any).lc_billed || 0), (matter as any).effective_currency ?? matter.fee_currency)
                                ) : (
                                  <span className="text-muted-foreground/50">-</span>
                                )}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-medium",
                                matter.headroom < 0 ? "text-danger" : "text-foreground"
                              )}>
                                {formatCurrency(matter.headroom, (matter as any).effective_currency ?? matter.fee_currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn(
                                  "font-medium",
                                  headroomStatus === 'danger' && 'text-danger',
                                  headroomStatus === 'warning' && 'text-warning',
                                  headroomStatus === 'success' && 'text-success'
                                )}>
                                  {matter.headroom_percent.toFixed(0)}%
                                </span>
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
                                    {format(parseISO(matter.clarifications_date), 'dd MMM')}
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
                                        {format(deadlineDate, 'dd MMM')}
                                      </span>
                                    </div>
                                  );
                                })() : '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {matter.decision_date ? format(parseISO(matter.decision_date), 'dd MMM') : '-'}
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
                          {!isLost && (
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
                                  {(matter.category === 'Pipeline' ? pipelineStages : liveStages).map((stage) => (
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
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}