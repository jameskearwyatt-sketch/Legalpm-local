import { FinancialSnapshot } from '@/lib/hooks/useSnapshots';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface DiffField {
  label: string;
  key: keyof FinancialSnapshot;
}

const DIFF_FIELDS: DiffField[] = [
  { label: 'WIP', key: 'wip_amount' },
  { label: 'WIP Write-off', key: 'wip_write_off_amount' },
  { label: 'Billed', key: 'billed_amount' },
  { label: 'Accounts Receivable', key: 'accounts_receivable' },
  { label: 'Paid', key: 'paid_amount' },
];

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

interface SnapshotDiffViewProps {
  previous: FinancialSnapshot;
  current: FinancialSnapshot;
}

export default function SnapshotDiffView({ previous, current }: SnapshotDiffViewProps) {
  const diffs = DIFF_FIELDS.map(field => {
    const prev = (previous[field.key] as number) || 0;
    const curr = (current[field.key] as number) || 0;
    const delta = curr - prev;
    return { ...field, prev, curr, delta };
  }).filter(d => d.delta !== 0);

  if (diffs.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        No changes between these snapshots.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Changes: {previous.as_of_date} &rarr; {current.as_of_date}
      </div>
      {diffs.map(d => {
        const isPositive = d.delta > 0;
        const isIncreaseBad = d.key === 'wip_write_off_amount';
        const colorClass = isPositive
          ? isIncreaseBad ? 'text-red-600' : 'text-green-600'
          : isIncreaseBad ? 'text-green-600' : 'text-red-600';

        return (
          <div key={d.key} className="flex items-center justify-between text-xs gap-2">
            <span className="text-muted-foreground">{d.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{formatAmount(d.prev)}</span>
              <Minus className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="font-medium">{formatAmount(d.curr)}</span>
              <span className={`flex items-center gap-0.5 font-medium ${colorClass}`}>
                {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {formatAmount(Math.abs(d.delta))}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
