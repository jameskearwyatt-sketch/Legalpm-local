/**
 * Shared "Precedent Bank" component for the 4 simple analyst tools.
 *
 * Covers the common scaffolding:
 *   - Header card with positions / projects counters
 *   - Search input
 *   - Filter dropdowns (variable count per analyst)
 *   - Results card with volatility sorting + expand/collapse all
 *   - Category-grouped collapsibles with "What's Market?" trigger
 *   - Delete-confirm AlertDialog
 *   - Export Market Commentary button wiring
 *
 * Per-analyst divergence is absorbed via render props:
 *   - `renderPreFilterSection` (optional): e.g. Tolling's tech readiness card
 *   - `renderPrecedentRow`: per-analyst row content (expand behaviour, party
 *     name badges, etc.)
 *   - `renderWhatsMarketDialog`: per-analyst dialog wrapper (so the correct
 *     typed precedents flow through)
 *   - `filters`: array of dropdown configs, each with its own matches predicate
 *   - `extraSearchFields`: per-analyst fields (offtaker_name etc.) added to
 *     the full-text search pool
 */
import { useState, useMemo, type ReactNode } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Database, Loader2, ChevronDown, ChevronRight, X, Scale, ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExportMarketCommentaryButton } from '@/components/shared/ExportMarketCommentaryButton';
import { computeVolatilityScores, sortByVolatility } from '@/lib/precedentVolatility';

export interface PrecedentLikeBase {
  id: string;
  category: string;
  project_name: string;
  position_summary: string;
  jurisdiction: string | null;
  is_gold_standard: boolean;
  market_position: string | null;
  party_favorability: string | null;
}

export interface FilterConfig<T extends PrecedentLikeBase> {
  key: string;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  allLabel: string;
  options: { id: string; label: string }[];
  /** Width of the trigger, e.g. "w-48" or "w-56" */
  triggerWidthClass?: string;
  /** Predicate used to match precedents against the current filter value.
   *  Return true when the filter isn't active ("all"). */
  matches: (p: T, value: string) => boolean;
}

export interface CategoryOrderEntry {
  label: string;
  group?: string;
}

interface Props<T extends PrecedentLikeBase> {
  /** Hook data */
  precedents: T[];
  isLoading: boolean;
  uniqueProjectCount: number;
  onDelete: (id: string) => Promise<void> | void;

  /** Text */
  title: string;
  description: string;
  emptyStateHint?: string;

  /** Filters */
  filters: FilterConfig<T>[];
  /** Extra fields to search against (in addition to position_summary /
   *  project_name / category / jurisdiction). */
  extraSearchFields?: (p: T) => Array<string | null | undefined>;

  /** Category ordering + optional group subtitle */
  categoriesOrder: CategoryOrderEntry[];
  /** Optional getter so analysts with a `group` field can show it under
   *  the category label in the collapsible header. */
  getCategoryGroup?: (categoryLabel: string) => string | undefined;

  /** Render-prop for each precedent row under an expanded category */
  renderPrecedentRow: (p: T, onDelete: () => void) => ReactNode;

  /** Optional section shown between the header card and the search/filter
   *  card (e.g. Tolling's "Precedent Coverage by Technology"). */
  renderPreFilterSection?: () => ReactNode;

  /** Render the per-analyst WhatsMarketDialog. Called only when a category
   *  has been opened; caller is responsible for closing behaviour. */
  renderWhatsMarketDialog: (args: {
    category: string;
    precedents: T[];
    onClose: () => void;
  }) => ReactNode;

  /** Export Market Commentary button props */
  exportContext: string;
  exportAnalystTitle: string;
}

export function AnalystPrecedentBank<T extends PrecedentLikeBase>({
  precedents,
  isLoading,
  uniqueProjectCount,
  onDelete,
  title,
  description,
  filters,
  extraSearchFields,
  categoriesOrder,
  getCategoryGroup,
  renderPrecedentRow,
  renderPreFilterSection,
  renderWhatsMarketDialog,
  exportContext,
  exportAnalystTitle,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [whatsMarketCategory, setWhatsMarketCategory] = useState<string | null>(null);
  const [whatsMarketPrecedents, setWhatsMarketPrecedents] = useState<T[]>([]);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'contract' | 'volatility'>('contract');

  const hasActiveFilters = filters.some(f => f.value !== 'all');

  const filteredPrecedents = useMemo(() => {
    return precedents.filter(p => {
      if (p.is_gold_standard) return false;
      for (const f of filters) {
        if (f.value !== 'all' && !f.matches(p, f.value)) return false;
      }
      if (!search) return true;
      const sl = search.toLowerCase();
      const pool: Array<string | null | undefined> = [
        p.position_summary,
        p.project_name,
        p.category,
        p.jurisdiction,
        ...(extraSearchFields?.(p) ?? []),
      ];
      return pool.some(s => s?.toLowerCase().includes(sl));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precedents, search, ...filters.map(f => f.value)]);

  const filteredUniqueDeals = useMemo(
    () => new Set(filteredPrecedents.map(p => p.project_name)).size,
    [filteredPrecedents],
  );

  const groupedPrecedents = useMemo(() => {
    const g: Record<string, T[]> = {};
    for (const p of filteredPrecedents) {
      if (!g[p.category]) g[p.category] = [];
      g[p.category].push(p);
    }
    return g;
  }, [filteredPrecedents]);

  const toggleCategory = (c: string) =>
    setExpandedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const expandAll = () => setExpandedCategories(Object.keys(groupedPrecedents));
  const collapseAll = () => setExpandedCategories([]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await onDelete(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const clearAllFilters = () => {
    for (const f of filters) f.onValueChange('all');
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{filteredPrecedents.length}</p>
                  <p className="text-xs text-muted-foreground">Positions</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {hasActiveFilters ? filteredUniqueDeals : uniqueProjectCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {renderPreFilterSection?.()}

        {/* Search & Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search precedents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base"
              />
              {search && (
                <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearch('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {filters.length > 0 && (
              <div className="flex items-center gap-3">
                {filters.map(f => (
                  <Select key={f.key} value={f.value} onValueChange={f.onValueChange}>
                    <SelectTrigger className={f.triggerWidthClass ?? 'w-48'}>
                      <SelectValue placeholder={f.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{f.allLabel}</SelectItem>
                      {f.options.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    <X className="h-3 w-3 mr-1" /> Clear filters
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {filteredUniqueDeals} deal{filteredUniqueDeals !== 1 ? 's' : ''} · {filteredPrecedents.length} position{filteredPrecedents.length !== 1 ? 's' : ''}
              </CardTitle>
              {Object.keys(groupedPrecedents).length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'contract' | 'volatility')}>
                    <SelectTrigger className="h-7 w-[180px] text-xs">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract Order</SelectItem>
                      <SelectItem value="volatility">Negotiation Volatility</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">Expand all</Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">Collapse all</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPrecedents.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  {search || hasActiveFilters ? 'No precedents match your filters' : 'No precedents banked yet'}
                </p>
                {!search && !hasActiveFilters && emptyStateHintDefault}
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const volScores = computeVolatilityScores(groupedPrecedents);
                  const entries = Object.entries(groupedPrecedents);
                  const sorted = sortOrder === 'volatility'
                    ? sortByVolatility(entries, volScores)
                    : [...entries].sort((a, b) => {
                        const iA = categoriesOrder.findIndex(c => c.label === a[0]);
                        const iB = categoriesOrder.findIndex(c => c.label === b[0]);
                        return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
                      });
                  return sorted;
                })().map(([category, cp]) => {
                  const isExpanded = expandedCategories.includes(category);
                  const volScores = computeVolatilityScores(groupedPrecedents);
                  const volScore = sortOrder === 'volatility' ? volScores[category] : null;
                  const group = getCategoryGroup?.(category);
                  return (
                    <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                          <Checkbox
                            checked={selectedForExport.includes(category)}
                            onCheckedChange={(checked) => setSelectedForExport(prev => checked ? [...prev, category] : prev.filter(c => c !== category))}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          />
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{category}</span>
                              <Badge variant="secondary">{cp.length}</Badge>
                              {volScore && (
                                <Badge variant="outline" className={cn('text-xs', volScore.level === 'high' ? 'border-destructive/50 text-destructive bg-destructive/10' : volScore.level === 'medium' ? 'border-amber-500/50 text-amber-700 bg-amber-50' : 'border-green-500/50 text-green-700 bg-green-50')}>
                                  {volScore.level === 'high' ? '🔴' : volScore.level === 'medium' ? '🟡' : '🟢'} {volScore.level}
                                </Badge>
                              )}
                            </div>
                            {group && <span className="text-xs text-muted-foreground">{group}</span>}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWhatsMarketCategory(category);
                              setWhatsMarketPrecedents(cp);
                            }}
                          >
                            <Scale className="h-3.5 w-3.5" />
                            What's Market?
                          </Button>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-7 space-y-2">
                          {cp.map(p => renderPrecedentRow(p, () => setDeleteConfirmId(p.id)))}
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
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Precedent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this position from your precedent bank. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {whatsMarketCategory && renderWhatsMarketDialog({
        category: whatsMarketCategory,
        precedents: whatsMarketPrecedents,
        onClose: () => { setWhatsMarketCategory(null); setWhatsMarketPrecedents([]); },
      })}

      <ExportMarketCommentaryButton
        selectedCategories={selectedForExport}
        groupedPrecedents={groupedPrecedents}
        context={exportContext}
        analystTitle={exportAnalystTitle}
        onClearSelection={() => setSelectedForExport([])}
      />
    </>
  );
}

const emptyStateHintDefault = (
  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
    Mark agreements as "Agreed" and bank positions to build your library
  </p>
);
