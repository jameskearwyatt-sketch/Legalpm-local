import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTollingAnalyses } from '@/lib/hooks/useTollingAnalyses';
import { AnalystAnalysisTable } from '@/components/shared/AnalystAnalysisTable';
import { TollingAnalysisReport } from './TollingAnalysisReport';

export function TollingAnalysisList() {
  const { analyses, isLoading, deleteAnalysis } = useTollingAnalyses();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  if (selectedAnalysisId) {
    return (
      <TollingAnalysisReport
        analysisId={selectedAnalysisId}
        onNewAnalysis={() => setSelectedAnalysisId(null)}
        onViewHistory={() => setSelectedAnalysisId(null)}
      />
    );
  }

  return (
    <AnalystAnalysisTable
      analyses={analyses}
      isLoading={isLoading}
      description="View and manage your past tolling analyses"
      emptyStateHint="Upload a tolling agreement to get started"
      getAnalysisTypeLabel={(t) => (t === 'tolling_vs_bible' ? 'vs Knowledge' : 'vs Term Sheet')}
      getPerspectiveLabel={(p) => (p === 'offtaker' ? 'Offtaker' : 'Generator')}
      extraColumns={[
        {
          header: 'Technology',
          render: (a) => a.tolling_type ? (
            <Badge variant="outline" className="text-xs">
              {a.tolling_type.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          ) : '—',
        },
        {
          header: 'Stage',
          render: (a) => a.facility_stage ? (
            <Badge variant="secondary" className="text-xs">
              {a.facility_stage.charAt(0).toUpperCase() + a.facility_stage.slice(1)}
            </Badge>
          ) : '—',
        },
      ]}
      onOpenAnalysis={setSelectedAnalysisId}
      onDeleteAnalysis={(id) => deleteAnalysis.mutateAsync(id)}
    />
  );
}
