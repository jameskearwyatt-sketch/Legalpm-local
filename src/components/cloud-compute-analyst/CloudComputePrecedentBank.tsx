import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  useCloudComputePrecedentBank,
  type CloudComputePrecedent,
} from '@/lib/hooks/useCloudComputeAnalyses';
import { CloudComputeWhatsMarketDialog } from './CloudComputeWhatsMarketDialog';
import { CLOUD_COMPUTE_ALL_CATEGORIES, CLOUD_SERVICE_TYPES } from '@/lib/cloudComputeCategories';
import { AnalystPrecedentBank } from '@/components/shared/AnalystPrecedentBank';

export function CloudComputePrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useCloudComputePrecedentBank();
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  return (
    <AnalystPrecedentBank<CloudComputePrecedent>
      precedents={precedents}
      isLoading={isLoading}
      uniqueProjectCount={uniqueProjectCount}
      onDelete={(id) => deletePrecedent.mutateAsync(id)}
      title="Cloud Compute Precedent Bank"
      description="Search and query positions from your agreed cloud compute agreements"
      filters={[
        {
          key: 'service_type',
          value: serviceTypeFilter,
          onValueChange: setServiceTypeFilter,
          placeholder: 'All Service Types',
          allLabel: 'All Service Types',
          options: CLOUD_SERVICE_TYPES.map(t => ({ id: t.id, label: t.label })),
          matches: (p, v) => p.service_type === v,
        },
      ]}
      extraSearchFields={(p) => [p.tenant_name, p.provider_name]}
      categoriesOrder={CLOUD_COMPUTE_ALL_CATEGORIES}
      renderPrecedentRow={(p, onDelete) => (
        <div key={p.id} className="p-3 border rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{p.project_name}</span>
                <Badge variant="outline" className="text-xs">
                  {p.perspective === 'tenant' ? 'Tenant' : 'Provider'}
                </Badge>
                {p.jurisdiction && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">{p.jurisdiction}</Badge>
                )}
              </div>
              <div className="text-sm text-foreground whitespace-pre-line">{p.position_summary}</div>
              <p className="text-xs text-muted-foreground">{format(new Date(p.banked_at), 'PP')}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      renderWhatsMarketDialog={({ category, precedents: cp, onClose }) => (
        <CloudComputeWhatsMarketDialog
          open
          onOpenChange={(o) => { if (!o) onClose(); }}
          category={category}
          precedents={cp}
        />
      )}
      exportContext="cloud_compute"
      exportAnalystTitle="Cloud Compute Analyst"
    />
  );
}
