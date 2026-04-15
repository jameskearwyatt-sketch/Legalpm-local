import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trash2 } from 'lucide-react';
import {
  useCarbonPrecedentBank,
  type CarbonPrecedent,
} from '@/lib/hooks/useCarbonAnalyses';
import { CarbonWhatsMarketDialog } from './CarbonWhatsMarketDialog';
import { CARBON_ALL_CATEGORIES, CARBON_PROJECT_TYPES } from '@/lib/carbonCategories';
import { AnalystPrecedentBank } from '@/components/shared/AnalystPrecedentBank';

export function CarbonPrecedentBank() {
  const { precedents, isLoading, deletePrecedent, uniqueProjectCount } = useCarbonPrecedentBank();
  const [creditTypeFilter, setCreditTypeFilter] = useState<string>('all');

  return (
    <AnalystPrecedentBank<CarbonPrecedent>
      precedents={precedents}
      isLoading={isLoading}
      uniqueProjectCount={uniqueProjectCount}
      onDelete={(id) => deletePrecedent.mutateAsync(id)}
      title="Carbon Credit Precedent Bank"
      description="Search and query positions from your agreed carbon credit offtake agreements"
      filters={[
        {
          key: 'carbon_type',
          value: creditTypeFilter,
          onValueChange: setCreditTypeFilter,
          placeholder: 'All Credit Types',
          allLabel: 'All Credit Types',
          options: CARBON_PROJECT_TYPES.map(t => ({ id: t.id, label: t.label })),
          triggerWidthClass: 'w-56',
          matches: (p, v) => p.carbon_type === v,
        },
      ]}
      extraSearchFields={(p) => [p.buyer_name, p.seller_name]}
      categoriesOrder={CARBON_ALL_CATEGORIES}
      getCategoryGroup={(label) => CARBON_ALL_CATEGORIES.find(c => c.label === label)?.group}
      renderPrecedentRow={(p, onDelete) => (
        <div key={p.id} className="rounded-lg border bg-card p-2.5 hover:bg-muted/30 cursor-pointer">
          <div className="flex items-center gap-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium text-sm shrink-0">{p.project_name}</span>
            <span className="text-sm text-muted-foreground truncate flex-1">
              {p.position_summary.substring(0, 120)}
              {p.position_summary.length > 120 && '...'}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className="text-xs">
                {p.perspective === 'buyer' ? 'Buyer' : 'Seller'}
              </Badge>
              {p.jurisdiction && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">{p.jurisdiction}</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
      renderWhatsMarketDialog={({ category, precedents: cp, onClose }) => (
        <CarbonWhatsMarketDialog
          open
          onOpenChange={(o) => { if (!o) onClose(); }}
          category={category}
          precedents={cp}
        />
      )}
      exportContext="carbon"
      exportAnalystTitle="Carbon Credit Analyst"
    />
  );
}
