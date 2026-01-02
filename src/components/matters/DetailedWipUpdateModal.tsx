import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BudgetLineItem } from '@/lib/hooks/useBudgetVersions';

interface WipLineItem {
  id: string;
  work_item: string;
  category: string | null;
  fee_amount: number;
  provider: string;
  lc_firm_name: string | null;
  wip_amount: number;
}

interface DetailedWipUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineItems: BudgetLineItem[];
  onFinalize: (wipUpdates: { id: string; wip_amount: number }[]) => Promise<void>;
  formatCurrency: (value: number, currency?: string) => string;
  currency: string;
}

// Get health color based on WIP percentage of estimate
function getHealthColor(wipAmount: number, feeAmount: number): { bg: string; text: string; indicator: string } {
  if (feeAmount <= 0) {
    return { bg: 'bg-muted', text: 'text-muted-foreground', indicator: 'bg-muted-foreground' };
  }
  
  const percentage = (wipAmount / feeAmount) * 100;
  
  if (percentage <= 50) {
    // Green - 0-50%
    return { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', indicator: 'bg-green-500' };
  } else if (percentage <= 70) {
    // Yellow-green - 50-70%
    return { bg: 'bg-lime-50 dark:bg-lime-950/30', text: 'text-lime-700 dark:text-lime-400', indicator: 'bg-lime-500' };
  } else if (percentage <= 85) {
    // Amber - 70-85%
    return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', indicator: 'bg-amber-500' };
  } else if (percentage <= 100) {
    // Orange - 85-100%
    return { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', indicator: 'bg-orange-500' };
  } else {
    // Red - 100%+
    return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', indicator: 'bg-red-500' };
  }
}

function getPercentage(wipAmount: number, feeAmount: number): string {
  if (feeAmount <= 0) return '-';
  return `${Math.round((wipAmount / feeAmount) * 100)}%`;
}

export function DetailedWipUpdateModal({
  isOpen,
  onClose,
  lineItems,
  onFinalize,
  formatCurrency,
  currency,
}: DetailedWipUpdateModalProps) {
  const [wipItems, setWipItems] = useState<WipLineItem[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Initialize WIP items from line items
  useEffect(() => {
    if (isOpen && lineItems.length > 0) {
      setWipItems(
        lineItems.map(item => ({
          id: item.id,
          work_item: item.work_item,
          category: item.category,
          fee_amount: item.fee_amount,
          provider: item.provider,
          lc_firm_name: item.lc_firm_name,
          wip_amount: (item as any).wip_amount || 0,
        }))
      );
      setHasAcknowledged(false);
    }
  }, [isOpen, lineItems]);

  const updateWipAmount = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWipItems(prev =>
      prev.map(item => (item.id === id ? { ...item, wip_amount: numValue } : item))
    );
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await onFinalize(wipItems.map(item => ({ id: item.id, wip_amount: item.wip_amount })));
      onClose();
    } catch (error) {
      console.error('Error finalizing WIP update:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Calculate totals
  const totalEstimate = wipItems.reduce((sum, item) => sum + item.fee_amount, 0);
  const totalWip = wipItems.reduce((sum, item) => sum + item.wip_amount, 0);
  const overallHealth = getHealthColor(totalWip, totalEstimate);

  // Group items by category
  const groupedItems = wipItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, WipLineItem[]>);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Detailed WIP Update
          </DialogTitle>
          <DialogDescription>
            Update the work in progress for each budget line item
          </DialogDescription>
        </DialogHeader>

        {/* Health Warning */}
        {!hasAcknowledged && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-1">Important: Complete WIP Update Required</p>
              <p className="text-sm">
                For accurate financial tracking, you must update the WIP for <strong>all</strong> line items.
                Updating only some items will result in an inaccurate aggregate WIP figure.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-amber-500 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                onClick={() => setHasAcknowledged(true)}
              >
                I understand, proceed
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {hasAcknowledged && (
          <>
            {/* Overall Summary */}
            <div className={cn('rounded-lg p-4 border', overallHealth.bg)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn('text-sm font-medium', overallHealth.text)}>Overall Progress</p>
                  <p className={cn('text-2xl font-bold', overallHealth.text)}>
                    {formatCurrency(totalWip, currency)} / {formatCurrency(totalEstimate, currency)}
                  </p>
                </div>
                <div className={cn('text-3xl font-bold', overallHealth.text)}>
                  {getPercentage(totalWip, totalEstimate)}
                </div>
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full transition-all duration-300', overallHealth.indicator)}
                  style={{ width: `${Math.min((totalWip / totalEstimate) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Line Items by Category */}
            <div className="space-y-4 mt-4">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 font-medium text-sm">
                    {category}
                  </div>
                  <div className="divide-y">
                    {items.map(item => {
                      const health = getHealthColor(item.wip_amount, item.fee_amount);
                      return (
                        <div
                          key={item.id}
                          className={cn('px-4 py-3 flex items-center gap-4', health.bg)}
                        >
                          {/* Health indicator dot */}
                          <div className={cn('w-3 h-3 rounded-full flex-shrink-0', health.indicator)} />
                          
                          {/* Work item description */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.work_item}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.provider === 'Local Counsel' && item.lc_firm_name
                                ? item.lc_firm_name
                                : item.provider}
                            </p>
                          </div>
                          
                          {/* Estimate */}
                          <div className="text-right flex-shrink-0 w-24">
                            <Label className="text-xs text-muted-foreground">Estimate</Label>
                            <p className="text-sm font-medium">{formatCurrency(item.fee_amount, currency)}</p>
                          </div>
                          
                          {/* WIP Input */}
                          <div className="flex-shrink-0 w-32">
                            <Label className="text-xs text-muted-foreground">WIP</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.wip_amount || ''}
                              onChange={e => updateWipAmount(item.id, e.target.value)}
                              className="h-8 text-sm"
                              placeholder="0"
                            />
                          </div>
                          
                          {/* Percentage */}
                          <div className={cn('w-16 text-right font-bold', health.text)}>
                            {getPercentage(item.wip_amount, item.fee_amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isFinalizing}>
            Cancel
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={isFinalizing || !hasAcknowledged}
          >
            {isFinalizing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Finalize WIP Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
