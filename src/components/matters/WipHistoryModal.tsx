import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, ChevronDown, ChevronRight, History, Calendar, TrendingUp, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useDetailedWipUpdates, DetailedWipUpdate, DetailedWipUpdateItem } from '@/lib/hooks/useDetailedWipUpdates';

interface WipHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matterId: string;
  formatCurrency: (value: number, currency?: string) => string;
  billingCurrency: string;
  quoteCurrency: string;
  mandatedRate: number;
  differentBillingCurrency: boolean;
}

// Get health color based on WIP percentage of estimate
function getHealthColor(wipAmount: number, feeAmount: number): { bg: string; text: string; indicator: string } {
  if (feeAmount <= 0) {
    return { bg: 'bg-muted', text: 'text-muted-foreground', indicator: 'bg-muted-foreground' };
  }
  
  const percentage = (wipAmount / feeAmount) * 100;
  
  if (percentage <= 50) {
    return { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', indicator: 'bg-green-500' };
  } else if (percentage <= 70) {
    return { bg: 'bg-lime-50 dark:bg-lime-950/30', text: 'text-lime-700 dark:text-lime-400', indicator: 'bg-lime-500' };
  } else if (percentage <= 85) {
    return { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', indicator: 'bg-amber-500' };
  } else if (percentage <= 100) {
    return { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', indicator: 'bg-orange-500' };
  } else {
    return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', indicator: 'bg-red-500' };
  }
}

function getPercentage(wipAmount: number, feeAmount: number): string {
  if (feeAmount <= 0) return '-';
  return `${Math.round((wipAmount / feeAmount) * 100)}%`;
}

function WipUpdateCard({ 
  update, 
  isLatest,
  onDelete,
  isDeleting,
  formatCurrency,
  billingCurrency,
  mandatedRate,
  differentBillingCurrency,
  fetchItems,
}: { 
  update: DetailedWipUpdate;
  isLatest: boolean;
  onDelete: () => void;
  isDeleting: boolean;
  formatCurrency: (value: number, currency?: string) => string;
  billingCurrency: string;
  mandatedRate: number;
  differentBillingCurrency: boolean;
  fetchItems: (id: string) => Promise<DetailedWipUpdateItem[]>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [items, setItems] = useState<DetailedWipUpdateItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const handleExpand = async () => {
    if (!isExpanded && items.length === 0) {
      setIsLoadingItems(true);
      try {
        const fetchedItems = await fetchItems(update.id);
        setItems(fetchedItems);
      } catch (error) {
        console.error('Error fetching WIP items:', error);
      } finally {
        setIsLoadingItems(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  // Calculate total estimate from items - values are stored in billing currency
  const totalEstimateQuote = items.reduce((sum, item) => sum + item.fee_amount, 0);
  const totalWipQuote = update.total_wip_amount;
  const totalWriteOffQuote = update.total_write_off_amount || 0;
  
  // No conversion needed - values are already in billing currency
  const totalEstimate = totalEstimateQuote;
  const totalWip = totalWipQuote;
  const totalWriteOff = totalWriteOffQuote;
  const overallHealth = getHealthColor(totalWip, totalEstimate || totalWip);

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, DetailedWipUpdateItem[]>);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className={cn(
          'flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'border-b'
        )}
        onClick={handleExpand}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(update.created_at), 'dd MMM yyyy, HH:mm')}
              </span>
              {isLatest && (
                <Badge variant="default" className="text-xs">
                  Current
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Total WIP: {formatCurrency(totalWip, billingCurrency)}
            {totalWriteOff > 0 && (
              <span className="text-destructive text-xs ml-2">
                (Write-off: {formatCurrency(totalWriteOff, billingCurrency)})
              </span>
            )}
          </p>
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete WIP Update?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this WIP update from {format(new Date(update.created_at), 'dd MMM yyyy')}?
                  {isLatest && (
                    <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">
                      This is the current WIP update. The budget line items will be reverted to the previous update's values (or reset to 0 if no previous update exists).
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 bg-muted/20">
          {isLoadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No items found</p>
          ) : (
            <div className="space-y-4">
              {/* Overall Summary */}
              <div className={cn('rounded-lg p-3 border', overallHealth.bg)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-medium', overallHealth.text)}>Overall Progress</p>
                    <p className={cn('text-xl font-bold', overallHealth.text)}>
                      {formatCurrency(totalWip, billingCurrency)} / {formatCurrency(totalEstimate, billingCurrency)}
                    </p>
                    {totalWriteOff > 0 && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <MinusCircle className="h-3 w-3" />
                        Write-off: {formatCurrency(totalWriteOff, billingCurrency)}
                      </p>
                    )}
                  </div>
                  <div className={cn('text-2xl font-bold', overallHealth.text)}>
                    {getPercentage(update.total_wip_amount, totalEstimate)}
                  </div>
                </div>
              </div>

              {/* Items by Category */}
              <div className="space-y-3">
                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                  <div key={category} className="border rounded-lg overflow-hidden bg-background">
                    <div className="bg-muted/50 px-3 py-2 font-medium text-sm">
                      {category}
                    </div>
                    <div className="divide-y">
                      {categoryItems.map(item => {
                        // Values are stored in billing currency - no conversion needed
                        const displayWip = item.wip_amount;
                        const displayFee = item.fee_amount;
                        const health = getHealthColor(displayWip, displayFee);
                        return (
                          <div
                            key={item.id}
                            className={cn('px-3 py-2 flex items-center gap-3 text-sm', health.bg)}
                          >
                            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', health.indicator)} />
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{item.work_item}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.provider === 'Local Counsel' && item.lc_firm_name
                                  ? item.lc_firm_name
                                  : item.provider}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-muted-foreground">
                                {formatCurrency(displayWip, billingCurrency)}
                              </span>
                              <span className="text-muted-foreground mx-1">/</span>
                              <span>{formatCurrency(displayFee, billingCurrency)}</span>
                            </div>
                            <div className={cn('w-12 text-right font-medium', health.text)}>
                              {getPercentage(displayWip, displayFee)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WipHistoryModal({
  isOpen,
  onClose,
  matterId,
  formatCurrency,
  billingCurrency,
  quoteCurrency,
  mandatedRate,
  differentBillingCurrency,
}: WipHistoryModalProps) {
  const { 
    wipUpdates, 
    isLoading, 
    fetchWipUpdateItems, 
    deleteWipUpdate 
  } = useDetailedWipUpdates(matterId);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (updateId: string) => {
    setDeletingId(updateId);
    try {
      await deleteWipUpdate.mutateAsync({ wipUpdateId: updateId, matterId });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Budget Utilisation History
          </DialogTitle>
          <DialogDescription>
            View and manage budget utilisation updates for this matter
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : wipUpdates.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No budget utilisation updates recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use the "Detailed Budget Utilisation Update" button to create your first update
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {wipUpdates.map((update, index) => (
              <WipUpdateCard
                key={update.id}
                update={update}
                isLatest={index === 0}
                onDelete={() => handleDelete(update.id)}
                isDeleting={deletingId === update.id}
                formatCurrency={formatCurrency}
                billingCurrency={billingCurrency}
                mandatedRate={mandatedRate}
                differentBillingCurrency={differentBillingCurrency}
                fetchItems={fetchWipUpdateItems}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
