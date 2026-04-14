import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { FileText, Plus, History, CheckCircle2, AlertCircle, HelpCircle, Database, ChevronDown, ChevronRight, Loader2, Filter, X, Lightbulb, Scale } from 'lucide-react';
import { useITSupplyAnalyses, useITSupplyPositions, useITSupplyPrecedentBank, ITSupplyExtractedPosition } from '@/lib/hooks/useITSupplyAnalyses';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';
import { AnalystAppliedContextBadge } from '@/components/shared/AnalystAppliedContextBadge';
import { ExportAnalystReportButton, type AnalystReportExport } from '@/components/shared/ExportAnalystReportButton';
import { ExportAnalystExcelButton } from '@/components/shared/ExportAnalystExcelButton';
import { SaveAsRegressionCaseButton } from '@/components/shared/SaveAsRegressionCaseButton';
import type { ActualPositionShape } from '@/lib/analyst/regressionHarness';
import { ITSupplyTeachFeedbackDialog } from './ITSupplyTeachFeedbackDialog';
import { ITSupplyWhatsMarketDialog } from './ITSupplyWhatsMarketDialog';
import { IT_SUPPLY_CATEGORY_GROUPS, IT_SUPPLY_ALL_CATEGORIES } from '@/lib/itSupplyCategories';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Props { analysisId: string; onNewAnalysis?: () => void; onViewHistory?: () => void; }

const confidenceConfig = {
  high: { icon: CheckCircle2, label: 'High Confidence', color: 'text-primary', bg: 'bg-primary/10' },
  medium: { icon: AlertCircle, label: 'Medium Confidence', color: 'text-accent-foreground', bg: 'bg-accent' },
  review_required: { icon: HelpCircle, label: 'Review Required', color: 'text-destructive', bg: 'bg-destructive/10' },
};

const marketPositionConfig = {
  on_market: { label: 'On Market', color: 'text-muted-foreground', bg: 'bg-muted border border-border' },
  off_market: { label: 'Off Market', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700' },
  way_off_market: { label: 'Way Off Market', color: 'text-destructive', bg: 'bg-destructive/15 border-2 border-destructive' },
};

function getMarketPositionFromNotes(notes: string | null): keyof typeof marketPositionConfig | null {
  if (!notes) return null;
  const match = notes.match(/\[(ON MARKET|OFF MARKET|WAY OFF MARKET)\]/i);
  if (match) { const pos = match[1].toLowerCase().replace(/ /g, '_'); if (pos in marketPositionConfig) return pos as keyof typeof marketPositionConfig; }
  return null;
}

function cleanVarianceNotes(notes: string | null): string | null {
  if (!notes) return null;
  return notes.replace(/\[(ON MARKET|OFF MARKET|WAY OFF MARKET)\]\s*/gi, '').replace(/\[(BUYER-FRIENDLY|SUPPLIER-FRIENDLY|BALANCED)\]\s*/gi, '').trim() || null;
}

type FilterState = { confidence: Set<string>; marketPosition: Set<string>; };

export function ITSupplyAnalysisReport({ analysisId, onNewAnalysis, onViewHistory }: Props) {
  const { analyses, updateAnalysis } = useITSupplyAnalyses();
  const { positions, isLoading: positionsLoading } = useITSupplyPositions(analysisId);
  const { bankPositions, getCategoryStats, precedents: bankPrecedents } = useITSupplyPrecedentBank();
  const { learnings } = useITSupplyLearnings();

  const [selectedForBanking, setSelectedForBanking] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(IT_SUPPLY_CATEGORY_GROUPS.map(g => g)));
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ confidence: new Set(), marketPosition: new Set() });
  const [teachDialogPosition, setTeachDialogPosition] = useState<ITSupplyExtractedPosition | null>(null);
  const [positionUpdates, setPositionUpdates] = useState<Record<string, string>>({});
  const [varianceNotesUpdates, setVarianceNotesUpdates] = useState<Record<string, string>>({});
  const [whatsMarketCategory, setWhatsMarketCategory] = useState<string | null>(null);

  const analysis = analyses.find(a => a.id === analysisId);

  const positionsWithAttributes = useMemo(() => {
    return positions.map(p => {
      const ev = varianceNotesUpdates[p.id] ?? p.variance_notes;
      const es = positionUpdates[p.id] ?? p.position_summary;
      const mc = IT_SUPPLY_ALL_CATEGORIES.find(c => c.id === p.category || c.label === p.category || c.id.toLowerCase() === p.category?.toLowerCase() || c.label.toLowerCase() === p.category?.toLowerCase());
      return { ...p, category: mc?.label || p.category, position_summary: es, variance_notes: ev, marketPosition: getMarketPositionFromNotes(ev) };
    });
  }, [positions, positionUpdates, varianceNotesUpdates]);

  const filteredPositions = useMemo(() => {
    return positionsWithAttributes.filter(p => {
      if (filters.confidence.size > 0 && !filters.confidence.has(p.confidence)) return false;
      if (filters.marketPosition.size > 0) { if (!p.marketPosition || !filters.marketPosition.has(p.marketPosition)) return false; }
      return true;
    });
  }, [positionsWithAttributes, filters]);

  const positionsByGroup = useMemo(() => {
    const grouped: Record<string, typeof filteredPositions> = {};
    for (const g of IT_SUPPLY_CATEGORY_GROUPS) grouped[g] = [];
    for (const p of filteredPositions) {
      const cat = IT_SUPPLY_ALL_CATEGORIES.find(c => c.id === p.category || c.label === p.category);
      const group = cat?.group || 'General';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(p);
    }
    return grouped;
  }, [filteredPositions]);

  const toggleFilter = (type: keyof FilterState, value: string) => {
    setFilters(prev => { const ns = new Set(prev[type]); if (ns.has(value)) ns.delete(value); else ns.add(value); return { ...prev, [type]: ns }; });
  };

  const activeFilterCount = filters.confidence.size + filters.marketPosition.size;

  const handlePositionUpdated = (positionId: string, newSummary: string, newVarianceNotes?: string) => {
    setPositionUpdates(prev => ({ ...prev, [positionId]: newSummary }));
    if (newVarianceNotes !== undefined) setVarianceNotesUpdates(prev => ({ ...prev, [positionId]: newVarianceNotes }));
  };

  const handleToggleGroup = (group: string) => { setExpandedGroups(prev => { const n = new Set(prev); if (n.has(group)) n.delete(group); else n.add(group); return n; }); };
  const handleToggleBankingSelection = (id: string) => { setSelectedForBanking(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const handleSelectAll = () => { if (selectedForBanking.size === positions.length) setSelectedForBanking(new Set()); else setSelectedForBanking(new Set(positions.map(p => p.id))); };

  const handleMarkAsAgreed = async () => {
    if (!analysis) return;
    try { await updateAnalysis.mutateAsync({ id: analysis.id, is_agreed: true, agreed_at: new Date().toISOString() }); toast.success('Contract marked as agreed'); } catch (e) { console.error(e); }
  };

  const handleBankSelected = async () => {
    if (selectedForBanking.size === 0 || !analysis) { toast.error('Please select positions to bank'); return; }
    const positionsToBank = positions.filter(p => selectedForBanking.has(p.id)).map(p => ({
      source_analysis_id: analysis.id, category: p.category, position_summary: p.position_summary,
      project_name: analysis.project_name, jurisdiction: analysis.jurisdiction, perspective: analysis.perspective,
      user_id: analysis.user_id, is_gold_standard: false, template_name: null, template_description: null,
      supply_type: analysis.supply_type || null, contract_stage: analysis.contract_stage || null,
      source_text: p.source_text || null, confidence: p.confidence || 'medium',
      market_position: p.variance_notes?.includes('[ON MARKET]') ? 'on_market' : p.variance_notes?.includes('[OFF MARKET]') ? 'off_market' : p.variance_notes?.includes('[WAY OFF MARKET]') ? 'way_off_market' : null,
      party_favorability: null, buyer_name: analysis.buyer_name || null, supplier_name: analysis.supplier_name || null,
      buyer_normalized: analysis.buyer_normalized || null, supplier_normalized: analysis.supplier_normalized || null,
    }));
    try { await bankPositions.mutateAsync(positionsToBank); setSelectedForBanking(new Set()); } catch (e) { console.error(e); }
  };

  const exportPayload: AnalystReportExport | null = useMemo(() => {
    if (!analysis) return null;
    return {
      analystTitle: 'IT Supply Analyst',
      projectName: analysis.project_name,
      analysisTypeLabel: analysis.analysis_type === 'contract_vs_bible' ? 'vs Knowledge Bank' : 'vs Term Sheet',
      perspectiveLabel: analysis.perspective === 'buyer' ? 'Buyer Perspective' : 'Supplier Perspective',
      jurisdiction: analysis.jurisdiction,
      extraBadges: [analysis.supply_type?.replace(/_/g, ' '), analysis.contract_stage?.replace(/_/g, ' ')].filter((b): b is string => !!b),
      isAgreed: !!analysis.is_agreed,
      createdAt: analysis.created_at,
      positionsByGroup: IT_SUPPLY_CATEGORY_GROUPS.map(g => ({
        group: g,
        positions: (positionsByGroup[g] || []).map(p => ({
          category: p.category,
          confidence: (p.confidence as 'high' | 'medium' | 'review_required') || null,
          marketPosition: p.marketPosition,
          positionSummary: p.position_summary,
          comparisonPosition: p.comparison_position,
          varianceNotes: p.variance_notes,
          sourceText: p.source_text,
        })),
      })),
    };
  }, [analysis, positionsByGroup]);

  if (!analysis) return <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground">Analysis not found</p></CardContent></Card>;
  if (positionsLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{analysis.project_name}</CardTitle>
              <CardDescription className="mt-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{analysis.analysis_type === 'contract_vs_bible' ? 'vs Knowledge Bank' : 'vs Term Sheet'}</Badge>
                  <Badge variant="secondary">{analysis.perspective === 'buyer' ? 'Buyer' : 'Supplier'} Perspective</Badge>
                  {analysis.jurisdiction && <Badge variant="secondary">{analysis.jurisdiction}</Badge>}
                  {analysis.supply_type && <Badge variant="outline">{analysis.supply_type.replace(/_/g, ' ')}</Badge>}
                  {analysis.is_agreed && <Badge className="bg-primary/10 text-primary border border-primary/30">Agreed</Badge>}
                </div>
                <p className="text-sm">Analyzed: {format(new Date(analysis.created_at), 'PPp')}</p>
                <div className="pt-1">
                  <AnalystAppliedContextBadge
                    appliedLearningIds={analysis.applied_learning_ids || []}
                    appliedPrecedentIds={analysis.applied_precedent_ids || []}
                    appliedGoldStandardIds={analysis.applied_gold_standard_ids || []}
                    learnings={(learnings || []).map(l => ({
                      id: l.id,
                      category: l.category,
                      user_feedback: l.correction_reason || `"${l.original_position}" should be "${l.corrected_position}"`,
                      corrected_position: l.corrected_position,
                      created_at: l.created_at,
                    }))}
                    precedents={(bankPrecedents || []).map(p => ({
                      id: p.id,
                      category: p.category,
                      project_name: p.project_name,
                      jurisdiction: p.jurisdiction,
                      is_gold_standard: p.is_gold_standard,
                      template_name: p.template_name,
                    }))}
                    analysisCreatedAt={analysis.created_at}
                  />
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {exportPayload && <ExportAnalystReportButton payload={exportPayload} />}
              {exportPayload && <ExportAnalystExcelButton payload={exportPayload} />}
              {analysis && (
                <SaveAsRegressionCaseButton
                  analyst="it_supply"
                  analystLabel="IT Supply"
                  analysisId={analysis.id}
                  projectName={analysis.project_name}
                  positions={positions as unknown as ActualPositionShape[]}
                  defaultConfig={{
                    analysisType: analysis.analysis_type,
                    perspective: analysis.perspective,
                    jurisdiction: analysis.jurisdiction,
                    projectName: analysis.project_name,
                    supplyType: analysis.supply_type,
                    contractStage: analysis.contract_stage,
                    counterpartyType: null,
                    precedents: [],
                    userLearnings: '',
                  }}
                />
              )}
              <Button variant="outline" size="sm" onClick={onNewAnalysis}><Plus className="h-4 w-4 mr-1" /> New Analysis</Button>
              <Button variant="outline" size="sm" onClick={onViewHistory}><History className="h-4 w-4 mr-1" /> View History</Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Extracted Positions</CardTitle>
              <span className="text-sm text-muted-foreground">{filteredPositions.length === positions.length ? `${positions.length} positions` : `${filteredPositions.length} of ${positions.length} positions`}</span>
            </div>
            <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-1" /> Filters{activeFilterCount > 0 && <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{activeFilterCount}</Badge>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showFilters && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center justify-between"><span className="font-medium text-sm">Filter Positions</span>{activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={() => setFilters({ confidence: new Set(), marketPosition: new Set() })}><X className="h-3 w-3 mr-1" /> Clear all</Button>}</div>
              <div className="space-y-2"><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Confidence Level</span><div className="flex flex-wrap gap-2">{Object.entries(confidenceConfig).map(([key, config]) => { const isActive = filters.confidence.has(key); return <button key={key} onClick={() => toggleFilter('confidence', key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-background border hover:bg-accent'}`}><config.icon className="h-3 w-3" /> {config.label}</button>; })}</div></div>
              <div className="space-y-2"><span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Market Position</span><div className="flex flex-wrap gap-2">{Object.entries(marketPositionConfig).map(([key, config]) => { const isActive = filters.marketPosition.has(key); return <button key={key} onClick={() => toggleFilter('marketPosition', key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : `${config.bg} ${config.color} hover:opacity-80`}`}>{config.label}</button>; })}</div></div>
            </div>
          )}
          <div className="flex items-center gap-4 text-sm flex-wrap"><span className="text-muted-foreground">Legend:</span>{Object.entries(marketPositionConfig).map(([key, config]) => <div key={key} className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>{config.label}</div>)}</div>
          <Separator />
          <div className="space-y-4">
            {IT_SUPPLY_CATEGORY_GROUPS.map(group => {
              const gp = positionsByGroup[group] || [];
              if (gp.length === 0) return null;
              return (
                <Collapsible key={group} open={expandedGroups.has(group)} onOpenChange={() => handleToggleGroup(group)}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">{expandedGroups.has(group) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-medium">{group}</span><Badge variant="secondary" className="text-xs">{gp.length}</Badge></div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-6">
                      {gp.map(position => {
                        const conf = confidenceConfig[position.confidence as keyof typeof confidenceConfig] || confidenceConfig.medium;
                        const stats = getCategoryStats(position.category);
                        const cleanedNotes = cleanVarianceNotes(position.variance_notes);
                        const mc = position.marketPosition ? marketPositionConfig[position.marketPosition] : null;
                        return (
                          <div key={position.id} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {analysis.is_agreed && <Checkbox checked={selectedForBanking.has(position.id)} onCheckedChange={() => handleToggleBankingSelection(position.id)} />}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{position.category}</span>
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${conf.bg}`}><conf.icon className={`h-3 w-3 ${conf.color}`} /><span className={conf.color}>{conf.label}</span></div>
                                    {mc && <div className={`px-2 py-0.5 rounded text-xs font-medium ${mc.bg} ${mc.color}`}>{mc.label}</div>}
                                    {position.source_text && <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{position.source_text}</span>}
                                  </div>
                                  <div className="text-sm text-foreground whitespace-pre-line">{position.position_summary}</div>
                                  {position.comparison_position && <div className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 mt-1">{position.comparison_position}</div>}
                                  {cleanedNotes && <div className="text-xs text-muted-foreground">{cleanedNotes}</div>}
                                  {(position as any).market_benchmark && <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded text-xs"><span className="font-medium text-primary">📊 What's Market?</span><span className="text-muted-foreground ml-2">{(position as any).market_benchmark}</span></div>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {stats.count > 0 && <Badge variant="outline" className="text-xs">{stats.count} in bank</Badge>}
                                {stats.count >= 1 && <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10" onClick={() => setWhatsMarketCategory(position.category)}><Scale className="h-4 w-4 mr-1" /><span className="text-xs">Market</span></Button>}
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950" onClick={() => setTeachDialogPosition(position)}><Lightbulb className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {!analysis.is_agreed ? (<><p className="font-medium">Mark this contract as agreed?</p><p className="text-sm text-muted-foreground">Once agreed, you can bank positions to your precedent library</p></>) : (<><p className="font-medium">Bank positions to precedent library</p><p className="text-sm text-muted-foreground">Select positions above and click to add them to your precedent bank</p></>)}
            </div>
            <div className="flex gap-2">
              {!analysis.is_agreed ? (
                <Button onClick={handleMarkAsAgreed} disabled={updateAnalysis.isPending}>{updateAnalysis.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Agreed</Button>
              ) : (
                <><Button variant="outline" onClick={handleSelectAll}>{selectedForBanking.size === positions.length ? 'Deselect All' : 'Select All'}</Button><Button onClick={handleBankSelected} disabled={selectedForBanking.size === 0 || bankPositions.isPending}>{bankPositions.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}<Database className="h-4 w-4 mr-2" /> Bank Selected ({selectedForBanking.size})</Button></>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {teachDialogPosition && analysis && <ITSupplyTeachFeedbackDialog open={!!teachDialogPosition} onOpenChange={(open) => !open && setTeachDialogPosition(null)} position={teachDialogPosition} analysisId={analysisId} projectName={analysis.project_name} onPositionUpdated={(ns, nv) => handlePositionUpdated(teachDialogPosition.id, ns, nv)} />}
      {whatsMarketCategory && <ITSupplyWhatsMarketDialog open={!!whatsMarketCategory} onOpenChange={(open) => !open && setWhatsMarketCategory(null)} category={whatsMarketCategory} precedents={(bankPrecedents || []).filter(p => p.category === whatsMarketCategory)} />}
    </div>
  );
}
