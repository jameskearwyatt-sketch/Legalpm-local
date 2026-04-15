import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  useITSupplyPrecedentBank,
  type ITSupplyPrecedent,
} from '@/lib/hooks/useITSupplyAnalyses';
import { ITSupplyWhatsMarketDialog } from './ITSupplyWhatsMarketDialog';
import { IT_SUPPLY_ALL_CATEGORIES, IT_SUPPLY_TYPES } from '@/lib/itSupplyCategories';
import { AnalystPrecedentBank } from '@/components/shared/AnalystPrecedentBank';

export function ITSupplyPrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useITSupplyPrecedentBank();
  const [supplyTypeFilter, setSupplyTypeFilter] = useState<string>('all');

  return (
    <AnalystPrecedentBank<ITSupplyPrecedent>
      precedents={precedents}
      isLoading={isLoading}
      uniqueProjectCount={uniqueProjectCount}
      onDelete={(id) => deletePrecedent.mutateAsync(id)}
      title="IT Supply Precedent Bank"
      description="Search and query positions from your agreed supply contracts"
      filters={[
        {
          key: 'supply_type',
          value: supplyTypeFilter,
          onValueChange: setSupplyTypeFilter,
          placeholder: 'All Supply Types',
          allLabel: 'All Supply Types',
          options: IT_SUPPLY_TYPES.map(t => ({ id: t.id, label: t.label })),
          matches: (p, v) => p.supply_type === v,
        },
      ]}
      extraSearchFields={(p) => [p.buyer_name, p.supplier_name]}
      categoriesOrder={IT_SUPPLY_ALL_CATEGORIES}
      renderPrecedentRow={(p, onDelete) => (
        <div key={p.id} className="p-3 border rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{p.project_name}</span>
                <Badge variant="outline" className="text-xs">
                  {p.perspective === 'buyer' ? 'Buyer' : 'Supplier'}
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
        <ITSupplyWhatsMarketDialog
          open
          onOpenChange={(o) => { if (!o) onClose(); }}
          category={category}
          precedents={cp}
        />
      )}
      exportContext="it_supply"
      exportAnalystTitle="IT Supply Analyst"
    />
  );
}
