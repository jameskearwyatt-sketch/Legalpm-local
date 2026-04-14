import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useITSupplyAnalyses } from '@/lib/hooks/useITSupplyAnalyses';
import { IT_SUPPLY_TYPES } from '@/lib/itSupplyCategories';
import { AnalystAnalysisTable } from '@/components/shared/AnalystAnalysisTable';
import { ITSupplyAnalysisReport } from './ITSupplyAnalysisReport';

export function ITSupplyAnalysisList() {
  const { analyses, isLoading, deleteAnalysis } = useITSupplyAnalyses();
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);

  if (selectedAnalysisId) {
    return (
      <ITSupplyAnalysisReport
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
      description="View and manage your past IT supply contract analyses"
      emptyStateHint="Upload a supply contract to get started"
      getAnalysisTypeLabel={(t) => (t === 'contract_vs_bible' ? 'vs Knowledge' : 'vs Term Sheet')}
      getPerspectiveLabel={(p) => (p === 'buyer' ? 'Buyer' : 'Supplier')}
      extraColumns={[
        {
          header: 'Supply Type',
          render: (a) => a.supply_type ? (
            <Badge variant="outline" className="text-xs">
              {IT_SUPPLY_TYPES.find(t => t.id === a.supply_type)?.label || a.supply_type}
            </Badge>
          ) : '—',
        },
      ]}
      onOpenAnalysis={setSelectedAnalysisId}
      onDeleteAnalysis={(id) => deleteAnalysis.mutateAsync(id)}
    />
  );
}
