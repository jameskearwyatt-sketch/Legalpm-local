import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Database, Trash2, Loader2, ChevronDown, ChevronRight, X, Scale } from 'lucide-react';
import { useCloudComputePrecedentBank, CloudComputePrecedent } from '@/lib/hooks/useCloudComputeAnalyses';
import { CloudComputeWhatsMarketDialog } from './CloudComputeWhatsMarketDialog';
import { CLOUD_COMPUTE_ALL_CATEGORIES, CLOUD_SERVICE_TYPES } from '@/lib/cloudComputeCategories';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { ExportMarketCommentaryButton } from '@/components/shared/ExportMarketCommentaryButton';
import { computeVolatilityScores, sortByVolatility } from '@/lib/precedentVolatility';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CloudComputePrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useCloudComputePrecedentBank();
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');
  const [whatsMarketCategory, setWhatsMarketCategory] = useState<string | null>(null);
  const [whatsMarketPrecedents, setWhatsMarketPrecedents] = useState<CloudComputePrecedent[]>([]);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'contract' | 'volatility'>('contract');

  const filteredPrecedents = useMemo(() => precedents.filter(p => {
    if (p.is_gold_standard) return false;
    if (serviceTypeFilter !== 'all' && p.service_type !== serviceTypeFilter) return false;
    const sl = search.toLowerCase();
    return !search || p.position_summary.toLowerCase().includes(sl) || p.project_name.toLowerCase().includes(sl) || p.category.toLowerCase().includes(sl) || (p.jurisdiction?.toLowerCase().includes(sl)) || (p.tenant_name?.toLowerCase().includes(sl)) || (p.provider_name?.toLowerCase().includes(sl));
  }), [precedents, search, serviceTypeFilter]);

  const filteredUniqueDeals = useMemo(() => new Set(filteredPrecedents.map(p => p.project_name)).size, [filteredPrecedents]);
  const groupedPrecedents = useMemo(() => { const g: Record<string, CloudComputePrecedent[]> = {}; for (const p of filteredPrecedents) { if (!g[p.category]) g[p.category] = []; g[p.category].push(p); } return g; }, [filteredPrecedents]);

  const toggleCategory = (c: string) => setExpandedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const expandAll = () => setExpandedCategories(Object.keys(groupedPrecedents));
  const collapseAll = () => setExpandedCategories([]);
  const handleDelete = async () => { if (!deleteConfirmId) return; await deletePrecedent.mutateAsync(deleteConfirmId); setDeleteConfirmId(null); };

  return (
    <>
      <div className="space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"><CardHeader className="pb-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="p-2.5 rounded-lg bg-primary/10"><Database className="h-6 w-6 text-primary" /></div><div><CardTitle className="text-xl">Cloud Compute Precedent Bank</CardTitle><CardDescription>Search and query positions from your agreed cloud compute agreements</CardDescription></div></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-2xl font-bold">{filteredPrecedents.length}</p><p className="text-xs text-muted-foreground">Positions</p></div><div className="h-12 w-px bg-border" /><div className="text-right"><p className="text-2xl font-bold">{serviceTypeFilter !== 'all' ? filteredUniqueDeals : uniqueProjectCount}</p><p className="text-xs text-muted-foreground">Projects</p></div></div></div></CardHeader></Card>

        <Card><CardContent className="pt-6 space-y-4">
          <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Search precedents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-12 text-base" />{search && <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button>}</div>
          <div className="flex items-center gap-3"><Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}><SelectTrigger className="w-48"><SelectValue placeholder="All Service Types" /></SelectTrigger><SelectContent><SelectItem value="all">All Service Types</SelectItem>{CLOUD_SERVICE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select>{serviceTypeFilter !== 'all' && <Button variant="ghost" size="sm" onClick={() => setServiceTypeFilter('all')}><X className="h-3 w-3 mr-1" /> Clear</Button>}</div>
        </CardContent></Card>

        <Card><CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base">{filteredUniqueDeals} deal{filteredUniqueDeals !== 1 ? 's' : ''} · {filteredPrecedents.length} position{filteredPrecedents.length !== 1 ? 's' : ''}</CardTitle>{Object.keys(groupedPrecedents).length > 0 && <div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">Expand all</Button><Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">Collapse all</Button></div>}</div></CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filteredPrecedents.length === 0 ? <div className="text-center py-12"><Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" /><p className="text-lg font-medium text-muted-foreground">{search || serviceTypeFilter !== 'all' ? 'No precedents match' : 'No precedents banked yet'}</p></div> : (
              <div className="space-y-3">
                {Object.entries(groupedPrecedents).sort((a, b) => { const iA = CLOUD_COMPUTE_ALL_CATEGORIES.findIndex(c => c.label === a[0]); const iB = CLOUD_COMPUTE_ALL_CATEGORIES.findIndex(c => c.label === b[0]); return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB); }).map(([category, cp]) => {
                  const isExpanded = expandedCategories.includes(category);
                  return (
                    <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                      <CollapsibleTrigger asChild><div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"><Checkbox checked={selectedForExport.includes(category)} onCheckedChange={(checked) => setSelectedForExport(prev => checked ? [...prev, category] : prev.filter(c => c !== category))} onClick={(e) => e.stopPropagation()} className="shrink-0" />{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}<div className="flex-1"><div className="flex items-center gap-2"><span className="font-medium">{category}</span><Badge variant="secondary">{cp.length}</Badge></div></div><Button variant="outline" size="sm" className="h-7 text-xs gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20" onClick={(e) => { e.stopPropagation(); setWhatsMarketCategory(category); setWhatsMarketPrecedents(cp); }}><Scale className="h-3.5 w-3.5" /> What's Market?</Button></div></CollapsibleTrigger>
                      <CollapsibleContent><div className="mt-2 ml-7 space-y-2">
                        {cp.map(p => (
                          <div key={p.id} className="p-3 border rounded-lg"><div className="flex items-start justify-between"><div className="flex-1 min-w-0 space-y-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{p.project_name}</span><Badge variant="outline" className="text-xs">{p.perspective === 'tenant' ? 'Tenant' : 'Provider'}</Badge>{p.jurisdiction && <Badge variant="outline" className="text-xs border-primary/30 text-primary">{p.jurisdiction}</Badge>}</div><div className="text-sm text-foreground whitespace-pre-line">{p.position_summary}</div><p className="text-xs text-muted-foreground">{format(new Date(p.banked_at), 'PP')}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(p.id)}><Trash2 className="h-4 w-4" /></Button></div></div>
                        ))}
                      </div></CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Precedent?</AlertDialogTitle><AlertDialogDescription>This will remove this position from your precedent bank.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      {whatsMarketCategory && <CloudComputeWhatsMarketDialog open={!!whatsMarketCategory} onOpenChange={(o) => { if (!o) { setWhatsMarketCategory(null); setWhatsMarketPrecedents([]); } }} category={whatsMarketCategory} precedents={whatsMarketPrecedents} />}

      <ExportMarketCommentaryButton
        selectedCategories={selectedForExport}
        groupedPrecedents={groupedPrecedents}
        context="cloud_compute"
        analystTitle="Cloud Compute Analyst"
        onClearSelection={() => setSelectedForExport([])}
      />
    </>
  );
}
