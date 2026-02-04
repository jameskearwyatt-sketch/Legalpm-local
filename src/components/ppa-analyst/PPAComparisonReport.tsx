import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  GitCompare, 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle, 
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { PPAAnalysis, PPAExtractedPosition } from '@/lib/hooks/usePPAAnalyses';
import { PPA_CATEGORY_GROUPS, PPA_ALL_CATEGORIES, CHANGE_TYPE_CONFIG, ChangeType } from '@/lib/ppaCategories';
import { format } from 'date-fns';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PPAComparisonReportProps {
  analysis: PPAAnalysis;
  positions: PPAExtractedPosition[];
  onBack: () => void;
}

const confidenceConfig = {
  high: { icon: CheckCircle2, label: 'High', color: 'text-green-600', bg: 'bg-green-100' },
  medium: { icon: AlertCircle, label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  review_required: { icon: HelpCircle, label: 'Review', color: 'text-red-600', bg: 'bg-red-100' },
};

export function PPAComparisonReport({ analysis, positions, onBack }: PPAComparisonReportProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PPA_CATEGORY_GROUPS));
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Group positions by category group
  const positionsByGroup = useMemo(() => {
    const grouped: Record<string, PPAExtractedPosition[]> = {};
    
    for (const group of PPA_CATEGORY_GROUPS) {
      grouped[group] = [];
    }

    for (const position of positions) {
      const category = PPA_ALL_CATEGORIES.find(c => 
        c.label.toLowerCase() === (position.category || '').toLowerCase()
      );
      const group = category?.group || 'General';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(position);
    }

    return grouped;
  }, [positions]);

  // Calculate stats
  const stats = useMemo(() => {
    const modified = positions.filter(p => p.change_type === 'modified').length;
    const unchanged = positions.filter(p => p.change_type === 'unchanged').length;
    const added = positions.filter(p => p.change_type === 'added').length;
    const removed = positions.filter(p => p.change_type === 'removed').length;
    return { modified, unchanged, added, removed, total: positions.length };
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

  const getChangeConfig = (changeType: ChangeType | null) => {
    return CHANGE_TYPE_CONFIG[changeType || 'unchanged'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                {analysis.project_name}
              </CardTitle>
              <CardDescription className="mt-1 space-y-1">
                <p className="text-sm">
                  Compared: {format(new Date(analysis.created_at), 'PPp')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {analysis.notes}
                </p>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-700">{stats.modified}</div>
            <div className="text-sm text-amber-600">Modified</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-700">{stats.added}</div>
            <div className="text-sm text-green-600">New</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-700">{stats.removed}</div>
            <div className="text-sm text-red-600">Removed</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-slate-700">{stats.unchanged}</div>
            <div className="text-sm text-slate-600">Unchanged</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={showUnchanged ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowUnchanged(!showUnchanged)}
        >
          {showUnchanged ? 'Showing all' : 'Hiding unchanged'}
        </Button>
        <span className="text-sm text-muted-foreground">
          Click to {showUnchanged ? 'hide' : 'show'} unchanged provisions
        </span>
      </div>

      {/* Changes by Group */}
      <Card>
        <CardHeader>
          <CardTitle>Changes by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {PPA_CATEGORY_GROUPS.map(group => {
            let groupPositions = positionsByGroup[group] || [];
            
            // Filter unchanged if needed
            if (!showUnchanged) {
              groupPositions = groupPositions.filter(p => p.change_type !== 'unchanged');
            }
            
            if (groupPositions.length === 0) return null;

            const modifiedCount = groupPositions.filter(p => p.change_type === 'modified').length;
            const addedCount = groupPositions.filter(p => p.change_type === 'added').length;

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
                      {modifiedCount > 0 && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                          {modifiedCount} modified
                        </Badge>
                      )}
                      {addedCount > 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                          {addedCount} new
                        </Badge>
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-3 pl-6">
                    {groupPositions.map(position => {
                      const changeConfig = getChangeConfig(position.change_type as ChangeType);
                      const conf = confidenceConfig[position.confidence];
                      
                      return (
                        <div
                          key={position.id}
                          className={`p-4 border rounded-lg space-y-3 ${
                            position.change_type === 'modified' ? 'border-amber-200 bg-amber-50/50' :
                            position.change_type === 'added' ? 'border-green-200 bg-green-50/50' :
                            position.change_type === 'removed' ? 'border-red-200 bg-red-50/50' :
                            ''
                          }`}
                        >
                          {/* Header */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{position.category}</span>
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${changeConfig.bg}`}>
                              <span>{changeConfig.icon}</span>
                              <span className={changeConfig.color}>{changeConfig.label}</span>
                            </div>
                            {position.source_text && (
                              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                                {position.source_text}
                              </span>
                            )}
                          </div>

                          {/* Change Summary - THE KEY PART */}
                          {position.change_summary && position.change_type !== 'unchanged' && (
                            <div className="p-3 bg-white border rounded-md">
                              <p className="text-sm font-medium text-foreground">
                                {position.change_summary}
                              </p>
                            </div>
                          )}

                          {/* Current Position */}
                          <div className="text-sm text-foreground whitespace-pre-line">
                            {position.position_summary}
                          </div>

                          {/* Previous Position (for context) */}
                          {position.previous_position && position.change_type === 'modified' && (
                            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
                              <span className="font-medium">Previous: </span>
                              {position.previous_position}
                            </div>
                          )}

                          {/* Flags */}
                          {position.variance_notes && (
                            <p className="text-sm text-amber-700">
                              {position.variance_notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
