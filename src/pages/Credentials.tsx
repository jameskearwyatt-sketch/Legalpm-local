import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Award, Plus, Search, RefreshCw, MoreHorizontal, Pencil, Trash2,
  FileDown, Building2, Globe, Calendar, Filter,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import {
  useCredentials, type DealCredential, type CredentialFilters,
} from '@/lib/hooks/useCredentials';
import { CredentialForm } from '@/components/credentials/CredentialForm';
import { ExportCredentialsButton } from '@/components/credentials/ExportCredentialsButton';

const Credentials = () => {
  const [filters, setFilters] = useState<CredentialFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<DealCredential | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchInput || undefined,
  }), [filters, searchInput]);

  const {
    credentials, isLoading, createCredential, updateCredential, deleteCredential,
    syncFromMatters, allSectors, allDealTypes, allJurisdictions,
  } = useCredentials(activeFilters);

  const sortedCredentials = useMemo(() =>
    [...credentials].sort((a, b) => {
      const yearA = a.year_completed ?? 0;
      const yearB = b.year_completed ?? 0;
      if (yearB !== yearA) return yearB - yearA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
  [credentials]);

  const stats = useMemo(() => ({
    total: credentials.length,
    active: credentials.filter(c => c.status === 'Active').length,
    completed: credentials.filter(c => c.status === 'Completed').length,
    synced: credentials.filter(c => c.is_auto_generated).length,
  }), [credentials]);

  const handleCreate = (data: Parameters<typeof createCredential.mutate>[0]) => {
    createCredential.mutate(data, { onSuccess: () => setFormOpen(false) });
  };

  const handleUpdate = (data: Parameters<typeof createCredential.mutate>[0]) => {
    if (!editingCredential) return;
    updateCredential.mutate({ id: editingCredential.id, ...data }, {
      onSuccess: () => { setEditingCredential(null); setFormOpen(false); },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteCredential.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const clearFilters = () => {
    setFilters({});
    setSearchInput('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '') || searchInput;

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    credentials.forEach(c => { if (c.year_completed) years.add(c.year_completed); });
    return [...years].sort((a, b) => b - a);
  }, [credentials]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Award className="h-8 w-8" /> Deal Credentials
            </h1>
            <p className="text-muted-foreground mt-1">Your deal track record — filterable, exportable, always up to date.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => syncFromMatters.mutate()} disabled={syncFromMatters.isPending}>
              <RefreshCw className={`h-4 w-4 mr-1 ${syncFromMatters.isPending ? 'animate-spin' : ''}`} /> Sync from Matters
            </Button>
            <ExportCredentialsButton credentials={sortedCredentials} />
            <Button size="sm" onClick={() => { setEditingCredential(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Credential
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Credentials</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active Deals</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-purple-600">{stats.synced}</div>
            <p className="text-xs text-muted-foreground">From Live Matters</p>
          </CardContent></Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deals, clients, descriptions..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
                <Filter className="h-4 w-4" /> Filters
                {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">!</Badge>}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">Clear all</Button>
              )}
            </div>
            {showFilters && (
              <div className="grid grid-cols-5 gap-3 mt-3 pt-3 border-t">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Deal Type</label>
                  <Select value={filters.dealType || 'all'} onValueChange={v => setFilters({ ...filters, dealType: v === 'all' ? undefined : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {allDealTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Sector</label>
                  <Select value={filters.sector || 'all'} onValueChange={v => setFilters({ ...filters, sector: v === 'all' ? undefined : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sectors</SelectItem>
                      {allSectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Jurisdiction</label>
                  <Select value={filters.jurisdiction || 'all'} onValueChange={v => setFilters({ ...filters, jurisdiction: v === 'all' ? undefined : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All jurisdictions</SelectItem>
                      {allJurisdictions.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                  <Select value={filters.status || 'all'} onValueChange={v => setFilters({ ...filters, status: v === 'all' ? undefined : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Ongoing">Ongoing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Year</label>
                  <Select value={filters.yearFrom?.toString() || 'all'} onValueChange={v => setFilters({ ...filters, yearFrom: v === 'all' ? undefined : Number(v), yearTo: v === 'all' ? undefined : Number(v) })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credentials Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {sortedCredentials.length} Credential{sortedCredentials.length !== 1 ? 's' : ''}
              {hasActiveFilters && <span className="text-sm font-normal text-muted-foreground ml-2">(filtered)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading credentials...</div>
            ) : sortedCredentials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No credentials yet</p>
                <p className="text-sm mt-1">
                  Click "Sync from Matters" to import live deals, or "Add Credential" for historic deals.
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Deal</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Jurisdictions</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCredentials.map(cred => (
                      <TableRow key={cred.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{cred.deal_name}</div>
                          {cred.description && (
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cred.description}</div>
                          )}
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {cred.practice_areas?.map(pa => (
                              <Badge key={pa} variant="outline" className="text-[10px] py-0">{pa}</Badge>
                            ))}
                            {cred.is_auto_generated && (
                              <Badge variant="secondary" className="text-[10px] py-0">synced</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{cred.client_name}</TableCell>
                        <TableCell>
                          {cred.deal_type && <Badge variant="outline" className="text-xs">{cred.deal_type}</Badge>}
                          {cred.sector && <div className="text-xs text-muted-foreground mt-0.5">{cred.sector}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cred.jurisdictions?.map(j => (
                              <Badge key={j} variant="secondary" className="text-[10px] py-0">
                                <Globe className="h-2.5 w-2.5 mr-0.5" />{j}
                              </Badge>
                            ))}
                          </div>
                          {cred.has_institutional_involvement && cred.institutions?.length ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {cred.institutions.map(i => (
                                <Badge key={i} variant="outline" className="text-[10px] py-0 border-blue-300">
                                  <Building2 className="h-2.5 w-2.5 mr-0.5" />{i}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {cred.deal_value ? (
                            <span>{cred.deal_currency || 'USD'} {cred.deal_value.toLocaleString()}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {cred.year_completed || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            cred.status === 'Completed' ? 'default' :
                            cred.status === 'Active' ? 'secondary' : 'outline'
                          } className="text-xs">
                            {cred.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingCredential(cred); setFormOpen(true); }}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(cred.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <CredentialForm
        open={formOpen}
        onOpenChange={open => { if (!open) { setFormOpen(false); setEditingCredential(null); } else setFormOpen(true); }}
        credential={editingCredential}
        onSubmit={editingCredential ? handleUpdate : handleCreate}
        isSubmitting={createCredential.isPending || updateCredential.isPending}
        allSectors={allSectors}
        allDealTypes={allDealTypes}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credential?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this deal credential. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Credentials;
