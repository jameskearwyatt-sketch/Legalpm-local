import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useMatters, MatterWithFinancials } from '@/lib/hooks/useMatters';
import { useClients } from '@/lib/hooks/useClients';
import { Search, Plus, ArrowUpDown, Loader2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'matter_name' | 'agreed_budget_amount' | 'wip' | 'billed' | 'remaining' | 'budget_used' | 'collection';
type SortDirection = 'asc' | 'desc';

export default function Matters() {
  const { matters, isLoading } = useMatters();
  const { clients } = useClients();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('matter_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
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

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.matter_name.toLowerCase().includes(searchLower) ||
          m.matter_number.toLowerCase().includes(searchLower) ||
          m.clients?.name.toLowerCase().includes(searchLower) ||
          m.lead_partner?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
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
        case 'agreed_budget_amount':
          aVal = a.agreed_budget_amount;
          bVal = b.agreed_budget_amount;
          break;
        case 'wip':
          aVal = a.latest_snapshot?.wip_amount || 0;
          bVal = b.latest_snapshot?.wip_amount || 0;
          break;
        case 'billed':
          aVal = a.latest_snapshot?.billed_amount || 0;
          bVal = b.latest_snapshot?.billed_amount || 0;
          break;
        case 'remaining':
          aVal = a.remaining_budget;
          bVal = b.remaining_budget;
          break;
        case 'budget_used':
          aVal = a.budget_used_percent;
          bVal = b.budget_used_percent;
          break;
        case 'collection':
          aVal = a.collection_rate;
          bVal = b.collection_rate;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [matters, search, statusFilter, clientFilter, sortField, sortDirection]);

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

  const getBudgetStatus = (matter: MatterWithFinancials) => {
    if (matter.budget_used_percent > 100) return 'danger';
    if (matter.budget_used_percent >= 80) return 'warning';
    return 'success';
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Matters</h1>
            <p className="text-muted-foreground mt-1">Manage your legal matters and track budgets</p>
          </div>
          <Button asChild>
            <Link to="/matters/new">
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search matters, clients, partners..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
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
                <h3 className="text-lg font-medium text-foreground">No matters found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search || statusFilter !== 'all' || clientFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Get started by creating your first matter'}
                </p>
                {!search && statusFilter === 'all' && clientFilter === 'all' && (
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
                      <TableHead className="min-w-[200px]">
                        <SortableHeader field="matter_name">Matter</SortableHeader>
                      </TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="agreed_budget_amount">Budget</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="wip">WIP</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="billed">Billed</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="remaining">Remaining</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="budget_used">% Used</SortableHeader>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortableHeader field="collection">Collection</SortableHeader>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatters.map((matter) => {
                      const budgetStatus = getBudgetStatus(matter);
                      return (
                        <TableRow key={matter.id} className="group">
                          <TableCell>
                            <Link 
                              to={`/matters/${matter.id}`}
                              className="block hover:text-primary transition-colors"
                            >
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {matter.matter_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{matter.matter_number}</p>
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {matter.clients?.name}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={matter.status} />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(matter.agreed_budget_amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(matter.latest_snapshot?.wip_amount || 0)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(matter.latest_snapshot?.billed_amount || 0)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
                            matter.remaining_budget < 0 ? "text-danger" : "text-foreground"
                          )}>
                            {formatCurrency(matter.remaining_budget)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              budgetStatus === 'danger' && 'text-danger',
                              budgetStatus === 'warning' && 'text-warning',
                              budgetStatus === 'success' && 'text-success'
                            )}>
                              {matter.budget_used_percent.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              matter.collection_rate < 60 && 'text-danger',
                              matter.collection_rate >= 60 && matter.collection_rate < 80 && 'text-warning',
                              matter.collection_rate >= 80 && 'text-success'
                            )}>
                              {matter.collection_rate.toFixed(0)}%
                            </span>
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
