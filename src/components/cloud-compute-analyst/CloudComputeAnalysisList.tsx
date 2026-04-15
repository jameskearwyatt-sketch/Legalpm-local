import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useCloudComputeAnalyses } from '@/lib/hooks/useCloudComputeAnalyses';
import { CLOUD_SERVICE_TYPES } from '@/lib/cloudComputeCategories';
import { AnalystAnalysisTable } from '@/components/shared/AnalystAnalysisTable';
import { CloudComputeAnalysisReport } from './CloudComputeAnalysisReport';

export function CloudComputeAnalysisList() {
  const { analyses, isLoading, deleteAnalysis } = useCloudComputeAnalyses();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  if (selectedAnalysisId) {
    return (
      <CloudComputeAnalysisReport
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
      description="View and manage your past cloud compute analyses"
      getAnalysisTypeLabel={(t) => (t === 'agreement_vs_bible' ? 'vs Knowledge' : 'vs Term Sheet')}
      getPerspectiveLabel={(p) => (p === 'tenant' ? 'Tenant' : 'Provider')}
      extraColumns={[
        {
          header: 'Service',
          render: (a) => a.service_type ? (
            <Badge variant="outline" className="text-xs">
              {CLOUD_SERVICE_TYPES.find(t => t.id === a.service_type)?.label || a.service_type}
            </Badge>
          ) : '—',
        },
      ]}
      onOpenAnalysis={setSelectedAnalysisId}
      onDeleteAnalysis={(id) => deleteAnalysis.mutateAsync(id)}
    />
  );
}
