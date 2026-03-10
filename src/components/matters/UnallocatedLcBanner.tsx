import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currencyUtils';

interface UnallocatedLcBannerProps {
  totalWip: number;
  totalAr: number;
  totalPaid: number;
  currency: string;
  onAllocateNow: () => void;
}

export function UnallocatedLcBanner({
  totalWip,
  totalAr,
  totalPaid,
  currency,
  onAllocateNow,
}: UnallocatedLcBannerProps) {
  const total = totalWip + totalAr + totalPaid;
  if (total <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {formatCurrency(total, currency)} in LC fees pending allocation
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            {totalWip > 0 && `WIP: ${formatCurrency(totalWip, currency)}`}
            {totalAr > 0 && `${totalWip > 0 ? ' · ' : ''}AR: ${formatCurrency(totalAr, currency)}`}
            {totalPaid > 0 && `${(totalWip > 0 || totalAr > 0) ? ' · ' : ''}Paid: ${formatCurrency(totalPaid, currency)}`}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onAllocateNow} className="shrink-0 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50">
        Allocate Now
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
