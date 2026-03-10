import { useState, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/currencyUtils';
import { LocalCounsel } from '@/lib/hooks/useLocalCounsels';
import { UnallocatedLcDisbursement } from '@/lib/hooks/useUnallocatedLcDisbursements';
import { Building2, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AllocateLcDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unallocated: UnallocatedLcDisbursement[];
  localCounsels: LocalCounsel[];
  currency: string;
  matterId: string;
  onMarkAllocated: (id: string) => Promise<void>;
  onDeleteUnallocated: (id: string) => Promise<void>;
}

export function AllocateLcDialog({
  isOpen,
  onClose,
  unallocated,
  localCounsels,
  currency,
  matterId,
  onMarkAllocated,
  onDeleteUnallocated,
}: AllocateLcDialogProps) {
  const queryClient = useQueryClient();
  const [selectedLcId, setSelectedLcId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, { lcId: string; wipAmount: number; arAmount: number; paidAmount: number }>>({});

  const totalWip = unallocated.reduce((sum, d) => sum + Number(d.wip_amount || 0), 0);
  const totalAr = unallocated.reduce((sum, d) => sum + Number(d.ar_amount || 0), 0);
  const totalPaid = unallocated.reduce((sum, d) => sum + Number(d.paid_amount || 0), 0);

  // Simple mode: allocate all unallocated to a single LC
  const handleAllocateAll = async () => {
    if (!selectedLcId) return;
    setIsSubmitting(true);
    try {
      // Update the local counsel's amounts
      const lc = localCounsels.find(l => l.id === selectedLcId);
      if (!lc) throw new Error('Local counsel not found');

      const newWip = (lc.wip_amount || 0) + totalWip;
      const newBilled = (lc.billed_amount || 0) + totalAr + totalPaid;

      const { error } = await supabase
        .from('matter_local_counsels')
        .update({
          wip_amount: newWip,
          billed_amount: newBilled,
          wip_updated_at: new Date().toISOString(),
          billed_updated_at: new Date().toISOString(),
          update_source: 'allocation',
          last_updated: new Date().toISOString(),
        })
        .eq('id', selectedLcId);

      if (error) throw error;

      // Mark all as allocated
      for (const item of unallocated) {
        await onMarkAllocated(item.id);
      }

      queryClient.invalidateQueries({ queryKey: ['local-counsels'] });
      toast.success(`Allocated ${formatCurrency(totalWip + totalAr + totalPaid, currency)} to ${lc.firm_name}`);
      onClose();
    } catch (error) {
      console.error('Failed to allocate:', error);
      toast.error('Failed to allocate LC fees');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await onDeleteUnallocated(id);
      toast.success('Unallocated entry removed');
      if (unallocated.length <= 1) onClose();
    } catch {
      toast.error('Failed to remove entry');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Allocate LC Fees
          </DialogTitle>
          <DialogDescription>
            Assign pending local counsel fees to a specific firm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary of what's pending */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {totalWip > 0 && (
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="text-xs text-muted-foreground">WIP</div>
                <div className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                  {formatCurrency(totalWip, currency)}
                </div>
              </div>
            )}
            {totalAr > 0 && (
              <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-xs text-muted-foreground">AR</div>
                <div className="font-semibold text-sm text-orange-700 dark:text-orange-400">
                  {formatCurrency(totalAr, currency)}
                </div>
              </div>
            )}
            {totalPaid > 0 && (
              <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800">
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="font-semibold text-sm text-rose-700 dark:text-rose-400">
                  {formatCurrency(totalPaid, currency)}
                </div>
              </div>
            )}
          </div>

          {/* Entries list */}
          {unallocated.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pending entries</Label>
              <ScrollArea className="max-h-[120px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {unallocated.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted">
                      <span>
                        {formatCurrency(Number(item.wip_amount) + Number(item.ar_amount) + Number(item.paid_amount), currency)}
                        <span className="text-muted-foreground ml-2">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteEntry(item.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Separator />

          {/* Select local counsel */}
          <div className="space-y-2">
            <Label>Allocate to local counsel</Label>
            {localCounsels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No local counsel firms configured. Add one in the Budget section first.
              </p>
            ) : (
              <ScrollArea className="max-h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {localCounsels.map(lc => (
                    <label
                      key={lc.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        selectedLcId === lc.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedLcId(lc.id)}
                    >
                      <input
                        type="radio"
                        name="lc-selection"
                        checked={selectedLcId === lc.id}
                        onChange={() => setSelectedLcId(lc.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{lc.firm_name}</div>
                        <div className="text-xs text-muted-foreground">
                          Budget: {formatCurrency(lc.allocated_budget, currency)}
                          {lc.wip_amount > 0 && ` · WIP: ${formatCurrency(lc.wip_amount, currency)}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleAllocateAll}
            disabled={!selectedLcId || isSubmitting || localCounsels.length === 0}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Allocate All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
