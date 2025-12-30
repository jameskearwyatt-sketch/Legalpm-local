import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMatters, MatterWithFinancials, MatterCategory } from '@/lib/hooks/useMatters';
import { useClients } from '@/lib/hooks/useClients';
import { Search, Plus, ArrowUpDown, Loader2, Briefcase, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'matter_name' | 'fee_amount' | 'headroom' | 'headroom_pct' | 'total_paid_ar_wip' | 'stage';
type SortDirection = 'asc' | 'desc';

const categoryIcons: Record<MatterCategory, React.ReactNode> = {
  Live: <Briefcase className="h-4 w-4" />,
  Pipeline: <TrendingUp className="h-4 w-4" />,
  Closed: <CheckCircle2 className="h-4 w-4" />,
  Lost: <XCircle className="h-4 w-4" />,
};

export default function Matters() {
  const { matters, isLoading } = useMatters();
  const { clients } = useClients();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MatterCategory>('Live');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('matter_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const formatCurrency = (value: number, currency: string = 'GBP') => {
    const symbols: Record<string, string> = {
      GBP: '£',
      USD: '$',
      EUR: '€',
      Ringgit: 'RM ',
      CHF: 'CHF ',
      AUD: 'A$',
      CAD: 'C$',
      SGD: 'S$',
    };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

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

    // Client filter
    if (clientFilter !== 'all') {
      result = result.filter((m) => m.client_id === clientFilter);
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
        case 'total_paid_ar_wip':
          aVal = a.total_paid_ar_wip || 0;
          bVal = b.total_paid_ar_wip || 0;
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
  }, [matters, search, categoryFilter, clientFilter, sortField, sortDirection]);

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

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Matters</h1>
            <p className="text-muted-foreground mt-1">Track live transactions, pipeline, and closed matters</p>
          </div>
          <Button asChild>
            <Link to="/matters/new">
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Link>
          </Button>
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
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total BM Fees (USD)</p>
                <p className="text-2xl font-bold text-foreground">
                  ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(categoryTotals)}
                </p>
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
                {!search && clientFilter === 'all' && (
                  <Button asChild className="mt-4">
                    <Link to="/matters/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Matter
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[180px]">
                        <SortableHeader field="matter_name">Client / Matter</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="fee_amount">Fee (Upper)</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">BM Fee</TableHead>
                      {isLive && (
                        <>
                          <TableHead className="text-right">
                            <SortableHeader field="total_paid_ar_wip">Paid+AR+WIP</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right">
                            <SortableHeader field="headroom">Headroom</SortableHeader>
                          </TableHead>
                          <TableHead className="text-right">
                            <SortableHeader field="headroom_pct">%</SortableHeader>
                          </TableHead>
                        </>
                      )}
                      {isPipeline && (
                        <>
                          <TableHead>Source</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Outcome</TableHead>
                        </>
                      )}
                      <TableHead>
                        <SortableHeader field="stage">Stage</SortableHeader>
                      </TableHead>
                      <TableHead>Practice</TableHead>
                      <TableHead>Originator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatters.map((matter) => {
                      const headroomStatus = getHeadroomStatus(matter);
                      const bmFeeUsd = (matter.bm_fee_component || 0) * (matter.exchange_rate || 1);
                      return (
                        <TableRow key={matter.id} className="group">
                          <TableCell>
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
                          <TableCell className="text-right font-medium">
                            {formatCurrency(matter.fee_amount_upper_end, matter.fee_currency)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(bmFeeUsd)}
                          </TableCell>
                          {isLive && (
                            <>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(matter.total_paid_ar_wip, matter.fee_currency)}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-medium",
                                matter.headroom < 0 ? "text-danger" : "text-foreground"
                              )}>
                                {formatCurrency(matter.headroom, matter.fee_currency)}
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
                          {isPipeline && (
                            <>
                              <TableCell className="text-muted-foreground">
                                {matter.source || '-'}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {matter.submission_deadline || '-'}
                              </TableCell>
                              <TableCell>
                                {matter.pipeline_outcome ? (
                                  <span className={cn(
                                    "text-sm font-medium px-2 py-1 rounded",
                                    matter.pipeline_outcome === 'Won' && 'bg-green-100 text-green-700',
                                    matter.pipeline_outcome === 'Lost' && 'bg-red-100 text-red-700',
                                    matter.pipeline_outcome === 'Pending' && 'bg-amber-100 text-amber-700'
                                  )}>
                                    {matter.pipeline_outcome}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Pending</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          <TableCell>
                            {matter.current_stage ? (
                              <span className="text-sm px-2 py-1 bg-muted rounded">
                                {matter.current_stage}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {matter.practice_area || '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {matter.originator || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}