import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Database, Trash2, Loader2, ChevronDown, ChevronRight, X, Scale } from 'lucide-react';
import { useCarbonPrecedentBank, CarbonPrecedent } from '@/lib/hooks/useCarbonAnalyses';
import { CarbonWhatsMarketDialog } from './CarbonWhatsMarketDialog';
import { CARBON_ALL_CATEGORIES, CARBON_PROJECT_TYPES, CARBON_PROJECT_STAGES } from '@/lib/carbonCategories';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { ExportMarketCommentaryButton } from '@/components/shared/ExportMarketCommentaryButton';

const MIN_DEALS_FOR_BENCHMARKING = 3;

export function CarbonPrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useCarbonPrecedentBank();
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [creditTypeFilter, setCreditTypeFilter] = useState<string>('all');
  const [whatsMarketCategory, setWhatsMarketCategory] = useState<string | null>(null);
  const [whatsMarketPrecedents, setWhatsMarketPrecedents] = useState<CarbonPrecedent[]>([]);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);

  const filteredPrecedents = useMemo(() => {
    return precedents.filter(p => {
      if (p.is_gold_standard) return false;
      if (creditTypeFilter !== 'all' && p.carbon_type !== creditTypeFilter) return false;
      const s = search.toLowerCase();
      return !search || p.position_summary.toLowerCase().includes(s) || p.project_name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s) || (p.jurisdiction?.toLowerCase().includes(s)) || (p.buyer_name?.toLowerCase().includes(s)) || (p.seller_name?.toLowerCase().includes(s));
    });
  }, [precedents, search, creditTypeFilter]);

  const filteredUniqueDeals = useMemo(() => new Set(filteredPrecedents.map(p => p.project_name)).size, [filteredPrecedents]);

  const groupedPrecedents = useMemo(() => {
    const grouped: Record<string, CarbonPrecedent[]> = {};
    for (const p of filteredPrecedents) { if (!grouped[p.category]) grouped[p.category] = []; grouped[p.category].push(p); }
    return grouped;
  }, [filteredPrecedents]);

  const toggleCategory = (category: string) => setExpandedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
  const expandAll = () => setExpandedCategories(Object.keys(groupedPrecedents));
  const collapseAll = () => setExpandedCategories([]);
  const handleDelete = async () => { if (!deleteConfirmId) return; await deletePrecedent.mutateAsync(deleteConfirmId); setDeleteConfirmId(null); };

  return (
    <>
      <div className="space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10"><Database className="h-6 w-6 text-primary" /></div>
                <div><CardTitle className="text-xl">Carbon Credit Precedent Bank</CardTitle><CardDescription>Search and query positions from your agreed carbon credit offtake agreements</CardDescription></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><p className="text-2xl font-bold">{filteredPrecedents.length}</p><p className="text-xs text-muted-foreground">Positions</p></div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right"><p className="text-2xl font-bold">{creditTypeFilter !== 'all' ? filteredUniqueDeals : uniqueProjectCount}</p><p className="text-xs text-muted-foreground">Projects</p></div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search precedents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-12 text-base" />
              {search && <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch('')}><X className="h-4 w-4" /></Button>}
            </div>
            <div className="flex items-center gap-3">
              <Select value={creditTypeFilter} onValueChange={setCreditTypeFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder="All Credit Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Credit Types</SelectItem>
                  {CARBON_PROJECT_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {creditTypeFilter !== 'all' && <Button variant="ghost" size="sm" onClick={() => setCreditTypeFilter('all')}><X className="h-3 w-3 mr-1" /> Clear</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{filteredUniqueDeals} deal{filteredUniqueDeals !== 1 ? 's' : ''} · {filteredPrecedents.length} position{filteredPrecedents.length !== 1 ? 's' : ''}</CardTitle>
              {Object.keys(groupedPrecedents).length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">Expand all</Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">Collapse all</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : filteredPrecedents.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">{search || creditTypeFilter !== 'all' ? 'No precedents match your filters' : 'No precedents banked yet'}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{search || creditTypeFilter !== 'all' ? 'Try adjusting your search or filters' : 'Mark agreements as "Agreed" and bank positions to build your library'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedPrecedents).sort((a, b) => {
                  const indexA = CARBON_ALL_CATEGORIES.findIndex(c => c.label === a[0]);
                  const indexB = CARBON_ALL_CATEGORIES.findIndex(c => c.label === b[0]);
                  return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                }).map(([category, categoryPrecedents]) => {
                  const isExpanded = expandedCategories.includes(category);
                  const catInfo = CARBON_ALL_CATEGORIES.find(c => c.label === category);
                  return (
                    <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2"><span className="font-medium">{category}</span><Badge variant="secondary">{categoryPrecedents.length}</Badge></div>
                            {catInfo && <span className="text-xs text-muted-foreground">{catInfo.group}</span>}
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20" onClick={(e) => { e.stopPropagation(); setWhatsMarketCategory(category); setWhatsMarketPrecedents(categoryPrecedents); }}>
                            <Scale className="h-3.5 w-3.5" />What's Market?
                          </Button>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-7 space-y-2">
                          {categoryPrecedents.map(precedent => (
                            <div key={precedent.id} className="rounded-lg border bg-card p-2.5 hover:bg-muted/30 cursor-pointer" onClick={() => {}}>
                              <div className="flex items-center gap-3">
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium text-sm shrink-0">{precedent.project_name}</span>
                                <span className="text-sm text-muted-foreground truncate flex-1">{precedent.position_summary.substring(0, 120)}{precedent.position_summary.length > 120 && '...'}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge variant="outline" className="text-xs">{precedent.perspective === 'buyer' ? 'Buyer' : 'Seller'}</Badge>
                                  {precedent.jurisdiction && <Badge variant="outline" className="text-xs border-primary/30 text-primary">{precedent.jurisdiction}</Badge>}
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(precedent.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove Precedent?</AlertDialogTitle><AlertDialogDescription>This will remove this position from your precedent bank.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {whatsMarketCategory && <CarbonWhatsMarketDialog open={!!whatsMarketCategory} onOpenChange={(open) => { if (!open) { setWhatsMarketCategory(null); setWhatsMarketPrecedents([]); } }} category={whatsMarketCategory} precedents={whatsMarketPrecedents} />}
    </>
  );
}
