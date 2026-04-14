import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2, ChevronDown, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useTollingPrecedentBank,
  type TollingPrecedent,
} from '@/lib/hooks/useTollingAnalyses';
import { TollingWhatsMarketDialog } from './TollingWhatsMarketDialog';
import {
  TOLLING_ALL_CATEGORIES,
  TOLLING_TECHNOLOGY_TYPES,
  TOLLING_FACILITY_STAGES,
} from '@/lib/tollingCategories';
import { AnalystPrecedentBank } from '@/components/shared/AnalystPrecedentBank';

const MIN_DEALS_FOR_BENCHMARKING = 3;

export function TollingPrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useTollingPrecedentBank();
  const [technologyFilter, setTechnologyFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const stats = useMemo(() => {
    const regular = precedents.filter(p => !p.is_gold_standard);
    const byTech: Record<string, Set<string>> = {};
    for (const p of regular) {
      const tech = p.tolling_type || 'unknown';
      if (!byTech[tech]) byTech[tech] = new Set();
      byTech[tech].add(p.project_name);
    }
    return { byTech };
  }, [precedents]);

  return (
    <AnalystPrecedentBank<TollingPrecedent>
      precedents={precedents}
      isLoading={isLoading}
      uniqueProjectCount={uniqueProjectCount}
      onDelete={(id) => deletePrecedent.mutateAsync(id)}
      title="Tolling Precedent Bank"
      description="Search and query positions from your agreed tolling agreements"
      filters={[
        {
          key: 'tolling_type',
          value: technologyFilter,
          onValueChange: setTechnologyFilter,
          placeholder: 'All Technologies',
          allLabel: 'All Technologies',
          options: TOLLING_TECHNOLOGY_TYPES.map(t => ({ id: t.id, label: t.label })),
          matches: (p, v) => p.tolling_type === v,
        },
        {
          key: 'facility_stage',
          value: stageFilter,
          onValueChange: setStageFilter,
          placeholder: 'All Stages',
          allLabel: 'All Stages',
          options: TOLLING_FACILITY_STAGES.map(s => ({ id: s.id, label: s.label })),
          matches: (p, v) => p.facility_stage === v,
        },
      ]}
      extraSearchFields={(p) => [p.offtaker_name, p.generator_name]}
      categoriesOrder={TOLLING_ALL_CATEGORIES}
      getCategoryGroup={(label) => TOLLING_ALL_CATEGORIES.find(c => c.label === label)?.group}
      renderPreFilterSection={() =>
        Object.keys(stats.byTech).length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium">Precedent Coverage by Technology</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byTech).map(([tech, deals]) => {
                  const techLabel = TOLLING_TECHNOLOGY_TYPES.find(t => t.id === tech)?.label || tech;
                  const dealCount = deals.size;
                  const isReady = dealCount >= MIN_DEALS_FOR_BENCHMARKING;
                  return (
                    <div
                      key={tech}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
                        isReady
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-muted border-border text-muted-foreground',
                      )}
                    >
                      {!isReady && <AlertTriangle className="h-3 w-3" />}
                      {techLabel}: {dealCount} deal{dealCount !== 1 ? 's' : ''}
                      {!isReady && (
                        <span className="opacity-70">
                          (need {MIN_DEALS_FOR_BENCHMARKING}+ for benchmarking)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null
      }
      renderPrecedentRow={(p, onDelete) => (
        <PrecedentCard key={p.id} precedent={p} onDelete={onDelete} />
      )}
      renderWhatsMarketDialog={({ category, precedents: cp, onClose }) => (
        <TollingWhatsMarketDialog
          open
          onOpenChange={(o) => { if (!o) onClose(); }}
          category={category}
          precedents={cp}
        />
      )}
      exportContext="tolling"
      exportAnalystTitle="Tolling Analyst"
    />
  );
}

function PrecedentCard({ precedent, onDelete }: { precedent: TollingPrecedent; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const summaryLines = precedent.position_summary.split('\n').filter(l => l.trim());
  const previewText = summaryLines[0]?.substring(0, 120) || 'No summary';
  const hasMoreContent = summaryLines.length > 1 || (summaryLines[0]?.length || 0) > 120;
  const techLabel = TOLLING_TECHNOLOGY_TYPES.find(t => t.id === precedent.tolling_type)?.label;
  const stageLabel = TOLLING_FACILITY_STAGES.find(s => s.id === precedent.facility_stage)?.label;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-all',
        expanded ? 'p-4 shadow-sm' : 'p-2.5 hover:bg-muted/30 cursor-pointer',
      )}
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
            {techLabel && <Badge variant="outline" className="text-xs">{techLabel}</Badge>}
            <Badge variant="outline" className="text-xs">
              {precedent.perspective === 'offtaker' ? 'Offtaker' : 'Generator'}
            </Badge>
            {precedent.jurisdiction && (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {precedent.jurisdiction}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="font-medium text-sm">{precedent.project_name}</span>
                {techLabel && <Badge variant="outline" className="text-xs">{techLabel}</Badge>}
                {stageLabel && <Badge variant="secondary" className="text-xs">{stageLabel}</Badge>}
                <Badge variant="outline" className="text-xs">
                  {precedent.perspective === 'offtaker' ? 'Offtaker' : 'Generator'}
                </Badge>
                {precedent.jurisdiction && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {precedent.jurisdiction}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(precedent.banked_at), 'PP')}
                </span>
              </div>
              {(precedent.offtaker_name || precedent.generator_name) && (
                <div className="flex items-center gap-3 ml-8 mb-2 text-xs">
                  {precedent.offtaker_name && (
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">Offtaker:</span> {precedent.offtaker_name}
                    </span>
                  )}
                  {precedent.generator_name && (
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">Generator:</span> {precedent.generator_name}
                    </span>
                  )}
                </div>
              )}
              <div className="text-sm space-y-1 ml-8">
                {summaryLines.map((line, i) => (
                  <p key={i} className="text-muted-foreground">{line}</p>
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
