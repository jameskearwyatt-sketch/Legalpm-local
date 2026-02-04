import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Plus, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  Database,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { usePPAAnalyses, usePPAPositions, usePPAPrecedentBank, PPAExtractedPosition } from '@/lib/hooks/usePPAAnalyses';
import { getCategoryById, PPA_CATEGORY_GROUPS, PPA_ALL_CATEGORIES } from '@/lib/ppaCategories';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PPAAnalysisReportProps {
  analysisId: string;
  onNewAnalysis?: () => void;
  onViewHistory?: () => void;
}

const confidenceConfig = {
  high: { icon: CheckCircle2, label: 'High Confidence', color: 'text-green-600', bg: 'bg-green-100' },
  medium: { icon: AlertCircle, label: 'Medium Confidence', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  review_required: { icon: HelpCircle, label: 'Review Required', color: 'text-red-600', bg: 'bg-red-100' },
};

export function PPAAnalysisReport({ analysisId, onNewAnalysis, onViewHistory }: PPAAnalysisReportProps) {
  const { analyses, updateAnalysis } = usePPAAnalyses();
  const { positions, isLoading: positionsLoading } = usePPAPositions(analysisId);
  const { bankPositions, precedents, getCategoryStats } = usePPAPrecedentBank();
  
  const [selectedForBanking, setSelectedForBanking] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PPA_CATEGORY_GROUPS));

  const analysis = analyses.find(a => a.id === analysisId);

  const positionsByGroup = useMemo(() => {
    const grouped: Record<string, PPAExtractedPosition[]> = {};
    
    for (const group of PPA_CATEGORY_GROUPS) {
      grouped[group] = [];
    }

    for (const position of positions) {
      const category = PPA_ALL_CATEGORIES.find(c => c.id === position.category || c.label === position.category);
      const group = category?.group || 'General';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(position);
    }

    return grouped;
  }, [positions]);

  const handleToggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleToggleBankingSelection = (positionId: string) => {
    setSelectedForBanking(prev => {
      const next = new Set(prev);
      if (next.has(positionId)) {
        next.delete(positionId);
      } else {
        next.add(positionId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedForBanking.size === positions.length) {
      setSelectedForBanking(new Set());
    } else {
      setSelectedForBanking(new Set(positions.map(p => p.id)));
    }
  };

  const handleMarkAsAgreed = async () => {
    if (!analysis) return;
    
    try {
      await updateAnalysis.mutateAsync({
        id: analysis.id,
        is_agreed: true,
        agreed_at: new Date().toISOString(),
      });
      toast.success('PPA marked as agreed');
    } catch (error) {
      console.error('Failed to mark as agreed:', error);
    }
  };

  const handleBankSelected = async () => {
    if (selectedForBanking.size === 0 || !analysis) {
      toast.error('Please select positions to bank');
      return;
    }

    const positionsToBank = positions
      .filter(p => selectedForBanking.has(p.id))
      .map(p => ({
        source_analysis_id: analysis.id,
        category: p.category,
        position_summary: p.position_summary,
        project_name: analysis.project_name,
        jurisdiction: analysis.jurisdiction,
        perspective: analysis.perspective,
        user_id: analysis.user_id,
      }));

    try {
      await bankPositions.mutateAsync(positionsToBank);
      setSelectedForBanking(new Set());
    } catch (error) {
      console.error('Failed to bank positions:', error);
    }
  };

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Analysis not found</p>
        </CardContent>
      </Card>
    );
  }

  if (positionsLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {analysis.project_name}
              </CardTitle>
              <CardDescription className="mt-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {analysis.analysis_type === 'ppa_vs_bible' ? 'PPA vs Bible' : 'PPA vs Term Sheet'}
                  </Badge>
                  <Badge variant="secondary">
                    {analysis.perspective === 'buyer' ? 'Buyer' : 'Seller'} Perspective
                  </Badge>
                  {analysis.jurisdiction && (
                    <Badge variant="secondary">{analysis.jurisdiction}</Badge>
                  )}
                  {analysis.is_agreed && (
                    <Badge className="bg-green-100 text-green-800">Agreed</Badge>
                  )}
                </div>
                <p className="text-sm">
                  Analyzed: {format(new Date(analysis.created_at), 'PPp')}
                </p>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onNewAnalysis}>
                <Plus className="h-4 w-4 mr-1" />
                New Analysis
              </Button>
              <Button variant="outline" size="sm" onClick={onViewHistory}>
                <History className="h-4 w-4 mr-1" />
                View History
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Extracted Positions</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {positions.length} positions extracted
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Confidence:</span>
            {Object.entries(confidenceConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <config.icon className={`h-4 w-4 ${config.color}`} />
                <span>{config.label}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Grouped Positions */}
          <div className="space-y-4">
            {PPA_CATEGORY_GROUPS.map(group => {
              const groupPositions = positionsByGroup[group] || [];
              if (groupPositions.length === 0) return null;

              return (
                <Collapsible
                  key={group}
                  open={expandedGroups.has(group)}
                  onOpenChange={() => handleToggleGroup(group)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-2">
                        {expandedGroups.has(group) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">{group}</span>
                        <Badge variant="secondary" className="text-xs">
                          {groupPositions.length}
                        </Badge>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 pl-6">
                      {groupPositions.map(position => {
                        const conf = confidenceConfig[position.confidence];
                        const stats = getCategoryStats(position.category);
                        
                        return (
                          <div
                            key={position.id}
                            className="p-4 border rounded-lg space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {analysis.is_agreed && (
                                  <Checkbox
                                    checked={selectedForBanking.has(position.id)}
                                    onCheckedChange={() => handleToggleBankingSelection(position.id)}
                                  />
                                )}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{position.category}</span>
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${conf.bg}`}>
                                      <conf.icon className={`h-3 w-3 ${conf.color}`} />
                                      <span className={conf.color}>{conf.label}</span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-foreground">
                                    {position.position_summary}
                                  </p>
                                  {position.source_text && (
                                    <p className="text-xs text-muted-foreground italic">
                                      Source: "{position.source_text.substring(0, 200)}..."
                                    </p>
                                  )}
                                  {position.bible_reference && (
                                    <p className="text-xs text-primary">
                                      Bible: {position.bible_reference}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {stats.count > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {stats.count} in precedent bank
                                </Badge>
                              )}
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

      {/* Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              {!analysis.is_agreed ? (
                <>
                  <p className="font-medium">Mark this PPA as agreed?</p>
                  <p className="text-sm text-muted-foreground">
                    Once agreed, you can bank positions to your precedent library
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Bank positions to precedent library</p>
                  <p className="text-sm text-muted-foreground">
                    Select positions above and click to add them to your precedent bank
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {!analysis.is_agreed ? (
                <Button onClick={handleMarkAsAgreed} disabled={updateAnalysis.isPending}>
                  {updateAnalysis.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Agreed
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleSelectAll}>
                    {selectedForBanking.size === positions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button 
                    onClick={handleBankSelected} 
                    disabled={selectedForBanking.size === 0 || bankPositions.isPending}
                  >
                    {bankPositions.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Database className="h-4 w-4 mr-2" />
                    Bank Selected ({selectedForBanking.size})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
