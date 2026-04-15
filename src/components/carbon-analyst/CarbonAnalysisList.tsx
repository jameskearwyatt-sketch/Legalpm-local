import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useCarbonAnalyses } from '@/lib/hooks/useCarbonAnalyses';
import { CARBON_PROJECT_TYPES } from '@/lib/carbonCategories';
import { AnalystAnalysisTable } from '@/components/shared/AnalystAnalysisTable';
import { CarbonAnalysisReport } from './CarbonAnalysisReport';

export function CarbonAnalysisList() {
  const { analyses, isLoading, deleteAnalysis } = useCarbonAnalyses();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  if (selectedAnalysisId) {
    return (
      <CarbonAnalysisReport
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
      description="View and manage your past carbon credit offtake analyses"
      emptyStateHint="Upload a carbon credit offtake agreement to get started"
      getAnalysisTypeLabel={(t) => (t === 'carbon_vs_bible' ? 'vs Knowledge' : 'vs Term Sheet')}
      getPerspectiveLabel={(p) => (p === 'buyer' ? 'Buyer' : 'Seller')}
      extraColumns={[
        {
          header: 'Credit Type',
          render: (a) => a.carbon_type ? (
            <Badge variant="outline" className="text-xs">
              {CARBON_PROJECT_TYPES.find(t => t.id === a.carbon_type)?.label || a.carbon_type}
            </Badge>
          ) : '—',
        },
      ]}
      onOpenAnalysis={setSelectedAnalysisId}
      onDeleteAnalysis={(id) => deleteAnalysis.mutateAsync(id)}
    />
  );
}
