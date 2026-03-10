import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Search, 
  Database, 
  Trash2, 
  Filter, 
  Loader2, 
  ChevronDown, 
  ChevronRight,
  Globe,
  Layers,
  X,
  Sparkles,
  Building2,
  FileText,
  Check,
  Crown,
  Star,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { usePPAPrecedentBank, PPAPrecedent } from '@/lib/hooks/usePPAAnalyses';
import { PPA_ALL_CATEGORIES, PPA_CATEGORY_GROUPS, PPACategoryGroup } from '@/lib/ppaCategories';
import { WhatsMarketDialog } from './WhatsMarketDialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ExportMarketCommentaryButton } from '@/components/shared/ExportMarketCommentaryButton';

// Market position config for display
const marketPositionConfig: Record<string, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  on_market: { label: 'On Market', color: 'text-green-700', bg: 'bg-green-100', icon: TrendingUp },
  off_market: { label: 'Off Market', color: 'text-amber-700', bg: 'bg-amber-100', icon: TrendingDown },
  way_off_market: { label: 'Way Off Market', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
};

// Helper to highlight search matches
function highlightText(text: string, search: string) {
  if (!search.trim()) return text;
  const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === search.toLowerCase() 
      ? <mark key={i} className="bg-accent text-accent-foreground px-0.5 rounded font-medium">{part}</mark>
      : part
  );
}

interface GroupedPrecedents {
  [category: string]: PPAPrecedent[];
}

export function PPAPrecedentBank() {
  const { precedents, goldStandardPrecedents, isLoading, deletePrecedent, uniqueProjectCount, uniqueTemplateCount } = usePPAPrecedentBank();
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);
  
  // UI state
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [whatsMarketCategory, setWhatsMarketCategory] = useState<string | null>(null);
  const [whatsMarketPrecedents, setWhatsMarketPrecedents] = useState<PPAPrecedent[]>([]);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);

  // Derive unique values for filters
  const uniqueJurisdictions = useMemo(() => {
    return [...new Set(precedents.map(p => p.jurisdiction).filter(Boolean) as string[])].sort();
  }, [precedents]);

  const uniqueProjects = useMemo(() => {
    return [...new Set(precedents.map(p => p.project_name))].sort();
  }, [precedents]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(precedents.map(p => p.category))].sort();
  }, [precedents]);

  // Use normalized names for grouping, but fall back to raw names if not available
  const uniqueBuyers = useMemo(() => {
    const buyers = precedents.map(p => p.buyer_normalized || p.buyer_name).filter(Boolean) as string[];
    return [...new Set(buyers)].sort();
  }, [precedents]);

  const uniqueSellers = useMemo(() => {
    const sellers = precedents.map(p => p.seller_normalized || p.seller_name).filter(Boolean) as string[];
    return [...new Set(sellers)].sort();
  }, [precedents]);

  // Filter precedents (exclude gold standard from regular list)
  const filteredPrecedents = useMemo(() => {
    return precedents.filter(p => {
      // Exclude gold standard from regular filtering
      if (p.is_gold_standard) return false;
      
      // Text search - also search buyer/seller names (both raw and normalized)
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        p.position_summary.toLowerCase().includes(searchLower) ||
        p.project_name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower) ||
        (p.jurisdiction?.toLowerCase().includes(searchLower)) ||
        (p.buyer_name?.toLowerCase().includes(searchLower)) ||
        (p.seller_name?.toLowerCase().includes(searchLower)) ||
        (p.buyer_normalized?.toLowerCase().includes(searchLower)) ||
        (p.seller_normalized?.toLowerCase().includes(searchLower));
      
      // Category filter (OR within)
      const matchesCategory = selectedCategories.length === 0 || 
        selectedCategories.includes(p.category);
      
      // Jurisdiction filter (OR within)
      const matchesJurisdiction = selectedJurisdictions.length === 0 || 
        (p.jurisdiction && selectedJurisdictions.includes(p.jurisdiction));
      
      // Perspective filter (OR within)
      const matchesPerspective = selectedPerspectives.length === 0 || 
        selectedPerspectives.includes(p.perspective);
      
      // Project filter (OR within)
      const matchesProject = selectedProjects.length === 0 || 
        selectedProjects.includes(p.project_name);
      
      // Buyer filter - match on normalized name (or raw name as fallback)
      const matchesBuyer = selectedBuyers.length === 0 || 
        selectedBuyers.includes(p.buyer_normalized || p.buyer_name || '');
      
      // Seller filter - match on normalized name (or raw name as fallback)
      const matchesSeller = selectedSellers.length === 0 || 
        selectedSellers.includes(p.seller_normalized || p.seller_name || '');
      
      return matchesSearch && matchesCategory && matchesJurisdiction && matchesPerspective && matchesProject && matchesBuyer && matchesSeller;
    });
  }, [precedents, search, selectedCategories, selectedJurisdictions, selectedPerspectives, selectedProjects, selectedBuyers, selectedSellers]);

  // Group by category for grouped view
  const groupedPrecedents = useMemo(() => {
    const grouped: GroupedPrecedents = {};
    for (const p of filteredPrecedents) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }
    return grouped;
  }, [filteredPrecedents]);

  // Stats
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const p of precedents) {
      stats[p.category] = (stats[p.category] || 0) + 1;
    }
    return stats;
  }, [precedents]);

  const jurisdictionStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const p of precedents) {
      if (p.jurisdiction) {
        stats[p.jurisdiction] = (stats[p.jurisdiction] || 0) + 1;
      }
    }
    return stats;
  }, [precedents]);

  // Check if any filters are active
  const hasActiveFilters = selectedCategories.length > 0 || 
    selectedJurisdictions.length > 0 || 
    selectedPerspectives.length > 0 || 
    selectedProjects.length > 0 ||
    selectedBuyers.length > 0 ||
    selectedSellers.length > 0 ||
    search.length > 0;

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setSelectedJurisdictions([]);
    setSelectedPerspectives([]);
    setSelectedProjects([]);
    setSelectedBuyers([]);
    setSelectedSellers([]);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const expandAll = () => {
    setExpandedCategories(Object.keys(groupedPrecedents));
  };

  const collapseAll = () => {
    setExpandedCategories([]);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePrecedent.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  // Multi-select filter component
  const MultiFilter = ({ 
    options, 
    selected, 
    onChange, 
    label, 
    icon,
    stats,
  }: { 
    options: string[]; 
    selected: string[]; 
    onChange: (v: string[]) => void; 
    label: string;
    icon: React.ReactNode;
    stats?: Record<string, number>;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn(
            "h-9 gap-2",
            selected.length > 0 && "border-primary bg-primary/5"
          )}
        >
          {icon}
          <span>{label}</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="h-6 text-xs">
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No options</p>
            ) : (
              options.map(opt => (
                <label 
                  key={opt}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent text-sm",
                    selected.includes(opt) && "bg-accent"
                  )}
                >
                  <Checkbox
                    checked={selected.includes(opt)}
                    onCheckedChange={() => {
                      onChange(
                        selected.includes(opt) 
                          ? selected.filter(v => v !== opt)
                          : [...selected, opt]
                      );
                    }}
                  />
                  <span className="flex-1 truncate">{opt}</span>
                  {stats && stats[opt] && (
                    <Badge variant="outline" className="h-5 text-xs">
                      {stats[opt]}
                    </Badge>
                  )}
                  {selected.includes(opt) && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </label>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  // Category multi-select with groups
  const CategoryFilter = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={cn(
            "h-9 gap-2",
            selectedCategories.length > 0 && "border-primary bg-primary/5"
          )}
        >
          <Layers className="h-4 w-4" />
          <span>Categories</span>
          {selectedCategories.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {selectedCategories.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Filter by Category</span>
          {selectedCategories.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedCategories([])} className="h-6 text-xs">
              Clear all
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          <div className="p-2 space-y-3">
            {PPA_CATEGORY_GROUPS.map(group => {
              const groupCategories = PPA_ALL_CATEGORIES
                .filter(c => c.group === group)
                .filter(c => uniqueCategories.includes(c.label));
              
              if (groupCategories.length === 0) return null;
              
              const allSelected = groupCategories.every(c => selectedCategories.includes(c.label));
              const someSelected = groupCategories.some(c => selectedCategories.includes(c.label));
              
              return (
                <div key={group}>
                  <div className="flex items-center gap-2 mb-1">
                    <Checkbox
                      checked={allSelected}
                      className={someSelected && !allSelected ? "opacity-50" : ""}
                      onCheckedChange={() => {
                        if (allSelected) {
                          setSelectedCategories(prev => 
                            prev.filter(c => !groupCategories.map(gc => gc.label).includes(c))
                          );
                        } else {
                          setSelectedCategories(prev => 
                            [...new Set([...prev, ...groupCategories.map(gc => gc.label)])]
                          );
                        }
                      }}
                    />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group}
                    </span>
                  </div>
                  <div className="ml-5 space-y-1">
                    {groupCategories.map(cat => (
                      <label 
                        key={cat.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-accent text-sm",
                          selectedCategories.includes(cat.label) && "bg-accent"
                        )}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(cat.label)}
                          onCheckedChange={() => {
                            setSelectedCategories(prev => 
                              prev.includes(cat.label)
                                ? prev.filter(c => c !== cat.label)
                                : [...prev, cat.label]
                            );
                          }}
                        />
                        <span className="flex-1 truncate">{cat.label}</span>
                        {categoryStats[cat.label] && (
                          <Badge variant="outline" className="h-5 text-xs">
                            {categoryStats[cat.label]}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Gold Standard Templates Section */}
        {goldStandardPrecedents.length > 0 && (
          <Card className="border-gold-border/50 bg-gradient-to-br from-gold/10 via-gold-muted/50 to-transparent">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-gold/20">
                  <Crown className="h-6 w-6 text-gold" />
                </div>
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <span>Gold Standard Templates</span>
                    <Badge variant="outline" className="border-gold-border/50 text-gold-foreground bg-gold-muted">
                      {uniqueTemplateCount} template{uniqueTemplateCount !== 1 ? 's' : ''} · {goldStandardPrecedents.length} positions
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Firm template positions used as benchmarks in every analysis
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Group by template name */}
                {(() => {
                  const byTemplate: Record<string, typeof goldStandardPrecedents> = {};
                  for (const p of goldStandardPrecedents) {
                    const key = p.template_name || 'Template';
                    if (!byTemplate[key]) byTemplate[key] = [];
                    byTemplate[key].push(p);
                  }
                  return Object.entries(byTemplate).map(([templateName, templatePositions]) => (
                    <div key={templateName} className="p-4 rounded-lg border border-gold-border/30 bg-gold-muted/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="h-5 w-5 text-gold fill-gold" />
                        <span className="font-semibold text-gold-foreground">{templateName}</span>
                        <Badge variant="secondary" className="bg-gold-muted text-gold-foreground">
                          {templatePositions.length} categories
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...new Set(templatePositions.map(p => p.category))].map(cat => (
                          <Badge key={cat} variant="outline" className="text-xs border-gold-border bg-card">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header with stats */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Precedent Bank</CardTitle>
                  <CardDescription>
                    Search and query positions from your agreed PPAs
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-2xl font-bold">{precedents.filter(p => !p.is_gold_standard).length}</p>
                  <p className="text-xs text-muted-foreground">Deal Precedents</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{uniqueProjects.length}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
                <div className="h-12 w-px bg-border" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{uniqueJurisdictions.length}</p>
                  <p className="text-xs text-muted-foreground">Jurisdictions</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Search & Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search precedents... (e.g., 'Statkraft', 'curtailment', or 'Shell buyer')"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearch('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4" />
                Filter:
              </span>
              
              <CategoryFilter />
              
              <MultiFilter
                options={uniqueJurisdictions}
                selected={selectedJurisdictions}
                onChange={setSelectedJurisdictions}
                label="Jurisdiction"
                icon={<Globe className="h-4 w-4" />}
                stats={jurisdictionStats}
              />
              
              <MultiFilter
                options={['buyer', 'seller']}
                selected={selectedPerspectives}
                onChange={setSelectedPerspectives}
                label="Perspective"
                icon={<Building2 className="h-4 w-4" />}
              />
              
              <MultiFilter
                options={uniqueProjects}
                selected={selectedProjects}
                onChange={setSelectedProjects}
                label="Project"
                icon={<FileText className="h-4 w-4" />}
              />

              {/* Buyer/Seller filters - only show if there are party names */}
              {uniqueBuyers.length > 0 && (
                <MultiFilter
                  options={uniqueBuyers}
                  selected={selectedBuyers}
                  onChange={setSelectedBuyers}
                  label="Buyer"
                  icon={<Building2 className="h-4 w-4" />}
                />
              )}
              
              {uniqueSellers.length > 0 && (
                <MultiFilter
                  options={uniqueSellers}
                  selected={selectedSellers}
                  onChange={setSelectedSellers}
                  label="Seller"
                  icon={<Building2 className="h-4 w-4" />}
                />
              )}

              {hasActiveFilters && (
                <>
                  <div className="h-6 w-px bg-border mx-1" />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                </>
              )}

              <div className="flex-1" />

              {/* View controls */}
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                  className="h-7 text-xs"
                >
                  Grouped
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 text-xs"
                >
                  List
                </Button>
              </div>
            </div>

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                <span className="text-xs text-muted-foreground">Active:</span>
                {selectedCategories.map(cat => (
                  <Badge key={cat} variant="secondary" className="gap-1">
                    {cat}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedCategories(prev => prev.filter(c => c !== cat))}
                    />
                  </Badge>
                ))}
                {selectedJurisdictions.map(jur => (
                  <Badge key={jur} variant="outline" className="gap-1 border-primary/30 bg-primary/5">
                    🌍 {jur}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedJurisdictions(prev => prev.filter(j => j !== jur))}
                    />
                  </Badge>
                ))}
                {selectedPerspectives.map(p => (
                  <Badge key={p} variant="outline" className="gap-1">
                    {p === 'buyer' ? 'Buyer' : 'Seller'}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedPerspectives(prev => prev.filter(v => v !== p))}
                    />
                  </Badge>
                ))}
                {selectedProjects.map(proj => (
                  <Badge key={proj} variant="outline" className="gap-1 border-muted-foreground/30 bg-muted">
                    📁 {proj}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedProjects(prev => prev.filter(p => p !== proj))}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {uniqueProjectCount} deal{uniqueProjectCount !== 1 ? 's' : ''} · {filteredPrecedents.length} position{filteredPrecedents.length !== 1 ? 's' : ''}
                  {hasActiveFilters && ` (filtered)`}
                </CardTitle>
              </div>
              {viewMode === 'grouped' && Object.keys(groupedPrecedents).length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs">
                    Expand all
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs">
                    Collapse all
                  </Button>
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
                  {hasActiveFilters ? 'No precedents match your filters' : 'No precedents banked yet'}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  {hasActiveFilters 
                    ? 'Try adjusting your search or filters to find what you\'re looking for'
                    : 'Mark PPAs as "Agreed" and bank positions to build your searchable library'
                  }
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : viewMode === 'grouped' ? (
              /* Grouped View */
              <div className="space-y-3">
                {Object.entries(groupedPrecedents)
                  .sort((a, b) => {
                    const indexA = PPA_ALL_CATEGORIES.findIndex(c => c.label === a[0]);
                    const indexB = PPA_ALL_CATEGORIES.findIndex(c => c.label === b[0]);
                    // Unknown categories go to the end
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                  })
                  .map(([category, categoryPrecedents]) => {
                    const isExpanded = expandedCategories.includes(category);
                    const catInfo = PPA_ALL_CATEGORIES.find(c => c.label === category);
                    
                    return (
                      <Collapsible 
                        key={category} 
                        open={isExpanded}
                        onOpenChange={() => toggleCategory(category)}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                            <Checkbox
                              checked={selectedForExport.includes(category)}
                              onCheckedChange={(checked) => {
                                setSelectedForExport(prev => checked ? [...prev, category] : prev.filter(c => c !== category));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                            />
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{category}</span>
                                <Badge variant="secondary">{categoryPrecedents.length}</Badge>
                              </div>
                              {catInfo && (
                                <span className="text-xs text-muted-foreground">{catInfo.group}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWhatsMarketCategory(category);
                                  setWhatsMarketPrecedents(categoryPrecedents);
                                }}
                              >
                                <Scale className="h-3.5 w-3.5" />
                                What's Market?
                              </Button>
                              <div className="flex items-center gap-1">
                                {[...new Set(categoryPrecedents.map(p => p.jurisdiction).filter(Boolean))].slice(0, 3).map(jur => (
                                  <Badge key={jur} variant="outline" className="text-xs">
                                    {jur}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 ml-7 space-y-2">
                            {categoryPrecedents.map(precedent => (
                              <PrecedentCard 
                                key={precedent.id} 
                                precedent={precedent}
                                search={search}
                                onDelete={() => setDeleteConfirmId(precedent.id)}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
              </div>
            ) : (
              /* List View */
              <div className="space-y-2">
                {filteredPrecedents.map(precedent => (
                  <PrecedentCard 
                    key={precedent.id} 
                    precedent={precedent}
                    search={search}
                    onDelete={() => setDeleteConfirmId(precedent.id)}
                    showCategory
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Precedent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this position from your precedent bank.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* What's Market Dialog */}
      {whatsMarketCategory && (
        <WhatsMarketDialog
          open={!!whatsMarketCategory}
          onOpenChange={(open) => {
            if (!open) {
              setWhatsMarketCategory(null);
              setWhatsMarketPrecedents([]);
            }
          }}
          category={whatsMarketCategory}
          precedents={whatsMarketPrecedents}
        />
      )}
    </>
  );
}

// Individual precedent card component - starts collapsed, expandable
function PrecedentCard({ 
  precedent, 
  search, 
  onDelete,
  showCategory = false,
}: { 
  precedent: PPAPrecedent; 
  search: string;
  onDelete: () => void;
  showCategory?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryLines = precedent.position_summary.split('\n').filter(l => l.trim());
  
  // Get first line as preview (truncated if needed)
  const previewText = summaryLines[0]?.substring(0, 120) || 'No summary';
  const hasMoreContent = summaryLines.length > 1 || (summaryLines[0]?.length || 0) > 120;

  return (
    <div 
      className={cn(
        "rounded-lg border bg-card transition-all",
        expanded ? "p-4 shadow-sm" : "p-2.5 hover:bg-muted/30 cursor-pointer"
      )}
      onClick={!expanded ? () => setExpanded(true) : undefined}
    >
      {!expanded ? (
        /* Collapsed view - compact single line */
        <div className="flex items-center gap-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {showCategory && (
            <Badge variant="secondary" className="shrink-0 text-xs">{precedent.category}</Badge>
          )}
          <span className="font-medium text-sm shrink-0">{highlightText(precedent.project_name, search)}</span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {highlightText(previewText, search)}{hasMoreContent && '...'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {precedent.market_position && marketPositionConfig[precedent.market_position] && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-medium",
                  marketPositionConfig[precedent.market_position].bg,
                  marketPositionConfig[precedent.market_position].color
                )}
              >
                {marketPositionConfig[precedent.market_position].label}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {precedent.perspective === 'buyer' ? 'Buyer' : 'Seller'}
            </Badge>
            {precedent.jurisdiction && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {precedent.jurisdiction}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        /* Expanded view - full details */
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {showCategory && (
                  <Badge variant="secondary">{precedent.category}</Badge>
                )}
                <span className="font-medium text-sm">{highlightText(precedent.project_name, search)}</span>
                <Badge variant="outline" className="text-xs">
                  {precedent.perspective === 'buyer' ? 'Buyer' : 'Seller'}
                </Badge>
                {precedent.jurisdiction && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {precedent.jurisdiction}
                  </Badge>
                )}
                {precedent.market_position && marketPositionConfig[precedent.market_position] && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-medium",
                      marketPositionConfig[precedent.market_position].bg,
                      marketPositionConfig[precedent.market_position].color
                    )}
                  >
                    {marketPositionConfig[precedent.market_position].label}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(precedent.banked_at), 'PP')}
                </span>
              </div>

              {/* Party names if available */}
              {(precedent.buyer_name || precedent.seller_name) && (
                <div className="flex items-center gap-3 ml-8 mb-2 text-xs">
                  {precedent.buyer_name && (
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">Buyer:</span> {highlightText(precedent.buyer_name, search)}
                    </span>
                  )}
                  {precedent.seller_name && (
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">Seller:</span> {highlightText(precedent.seller_name, search)}
                    </span>
                  )}
                </div>
              )}

              {/* Full position content */}
              <div className="text-sm space-y-1 ml-8">
                {summaryLines.map((line, i) => (
                  <p key={i} className="text-muted-foreground">
                    {highlightText(line, search)}
                  </p>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive shrink-0"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
