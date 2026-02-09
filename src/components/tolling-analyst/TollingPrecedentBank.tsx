import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search, Database, Trash2, Loader2, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { useTollingPrecedentBank, TollingPrecedent } from '@/lib/hooks/useTollingAnalyses';
import { TOLLING_ALL_CATEGORIES } from '@/lib/tollingCategories';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function TollingPrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useTollingPrecedentBank();

  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredPrecedents = useMemo(() => {
    return precedents.filter(p => {
      if (p.is_gold_standard) return false;
      const searchLower = search.toLowerCase();
      return !search ||
        p.position_summary.toLowerCase().includes(searchLower) ||
        p.project_name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower) ||
        (p.jurisdiction?.toLowerCase().includes(searchLower)) ||
        (p.offtaker_name?.toLowerCase().includes(searchLower)) ||
        (p.generator_name?.toLowerCase().includes(searchLower));
    });
  }, [precedents, search]);

  const groupedPrecedents = useMemo(() => {
    const grouped: Record<string, TollingPrecedent[]> = {};
    for (const p of filteredPrecedents) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }
    return grouped;
  }, [filteredPrecedents]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const expandAll = () => setExpandedCategories(Object.keys(groupedPrecedents));
  const collapseAll = () => setExpandedCategories([]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePrecedent.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
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
                  <CardTitle className="text-xl">Tolling Precedent Bank</CardTitle>
                  <CardDescription>Search and query positions from your agreed tolling agreements</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{filteredPrecedents.length}</p>
                  <p className="text-xs text-muted-foreground">Positions</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{uniqueProjectCount}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {uniqueProjectCount} deal{uniqueProjectCount !== 1 ? 's' : ''} · {filteredPrecedents.length} position{filteredPrecedents.length !== 1 ? 's' : ''}
              </CardTitle>
              {Object.keys(groupedPrecedents).length > 0 && (
                <div className="flex items-center gap-2">
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
                  {search ? 'No precedents match your search' : 'No precedents banked yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {search
                    ? "Try adjusting your search"
                    : 'Mark tolling agreements as "Agreed" and bank positions to build your library'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedPrecedents)
                  .sort((a, b) => {
                    const indexA = TOLLING_ALL_CATEGORIES.findIndex(c => c.label === a[0]);
                    const indexB = TOLLING_ALL_CATEGORIES.findIndex(c => c.label === b[0]);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                  })
                  .map(([category, categoryPrecedents]) => {
                    const isExpanded = expandedCategories.includes(category);
                    const catInfo = TOLLING_ALL_CATEGORIES.find(c => c.label === category);

                    return (
                      <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{category}</span>
                                <Badge variant="secondary">{categoryPrecedents.length}</Badge>
                              </div>
                              {catInfo && <span className="text-xs text-muted-foreground">{catInfo.group}</span>}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 ml-7 space-y-2">
                            {categoryPrecedents.map(precedent => (
                              <PrecedentCard key={precedent.id} precedent={precedent} onDelete={() => setDeleteConfirmId(precedent.id)} />
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
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Precedent?</AlertDialogTitle>
            <AlertDialogDescription>This will remove this position from your precedent bank. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PrecedentCard({ precedent, onDelete }: { precedent: TollingPrecedent; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const summaryLines = precedent.position_summary.split('\n').filter(l => l.trim());
  const previewText = summaryLines[0]?.substring(0, 120) || 'No summary';
  const hasMoreContent = summaryLines.length > 1 || (summaryLines[0]?.length || 0) > 120;

  return (
    <div
      className={cn('rounded-lg border bg-card transition-all', expanded ? 'p-4 shadow-sm' : 'p-2.5 hover:bg-muted/30 cursor-pointer')}
      onClick={!expanded ? () => setExpanded(true) : undefined}
    >
      {!expanded ? (
        <div className="flex items-center gap-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm shrink-0">{precedent.project_name}</span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {previewText}{hasMoreContent && '...'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-xs">
              {precedent.perspective === 'offtaker' ? 'Offtaker' : 'Generator'}
            </Badge>
            {precedent.jurisdiction && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">{precedent.jurisdiction}</Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="font-medium text-sm">{precedent.project_name}</span>
                <Badge variant="outline" className="text-xs">{precedent.perspective === 'offtaker' ? 'Offtaker' : 'Generator'}</Badge>
                {precedent.jurisdiction && <Badge variant="outline" className="text-xs border-primary/30 text-primary">{precedent.jurisdiction}</Badge>}
                <span className="text-xs text-muted-foreground">{format(new Date(precedent.banked_at), 'PP')}</span>
              </div>
              {(precedent.offtaker_name || precedent.generator_name) && (
                <div className="flex items-center gap-3 ml-8 mb-2 text-xs">
                  {precedent.offtaker_name && <span className="text-muted-foreground"><span className="font-medium text-foreground">Offtaker:</span> {precedent.offtaker_name}</span>}
                  {precedent.generator_name && <span className="text-muted-foreground"><span className="font-medium text-foreground">Generator:</span> {precedent.generator_name}</span>}
                </div>
              )}
              <div className="text-sm space-y-1 ml-8">
                {summaryLines.map((line, i) => <p key={i} className="text-muted-foreground">{line}</p>)}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
