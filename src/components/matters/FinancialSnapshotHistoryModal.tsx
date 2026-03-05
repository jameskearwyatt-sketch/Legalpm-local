import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FinancialSnapshot {
  id: string;
  as_of_date: string;
  wip_amount: number;
  wip_write_off_amount: number;
  billed_amount: number;
  accounts_receivable: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FinancialSnapshotHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: FinancialSnapshot[];
  currency: string;
  onDelete: (id: string) => Promise<void>;
}

export function FinancialSnapshotHistoryModal({
  isOpen,
  onClose,
  snapshots,
  currency,
  onDelete,
}: FinancialSnapshotHistoryModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  // Sort snapshots by date descending
  const sortedSnapshots = [...snapshots].sort((a, b) => 
    b.as_of_date.localeCompare(a.as_of_date)
  );

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Financial Snapshot History</DialogTitle>
          <DialogDescription>
            View and manage historical financial snapshots for this matter.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {sortedSnapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No financial snapshots recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedSnapshots.map((snapshot, index) => {
                // wip_amount IS already NET - write-off is tracked separately for realization
                const netWip = snapshot.wip_amount;
                const rawWip = netWip + (snapshot.wip_write_off_amount || 0);
                const isLatest = index === 0;
                
                return (
                  <div
                    key={snapshot.id}
                    className={cn(
                      "border rounded-lg p-4 space-y-3",
                      isLatest && "border-primary/50 bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(new Date(snapshot.as_of_date), 'dd MMM yyyy')}
                        </span>
                        {isLatest && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === snapshot.id}
                          >
                            {deletingId === snapshot.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Snapshot</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the snapshot from{' '}
                              <strong>{format(new Date(snapshot.as_of_date), 'dd MMM yyyy')}</strong>?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(snapshot.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Raw WIP</p>
                        <p className="font-medium">{formatCurrency(rawWip, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Write-off</p>
                        <p className="font-medium text-destructive">
                          {snapshot.wip_write_off_amount > 0 
                            ? `-${formatCurrency(snapshot.wip_write_off_amount, currency)}`
                            : '—'
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net WIP</p>
                        <p className="font-medium">{formatCurrency(netWip, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Billed</p>
                        <p className="font-medium">{formatCurrency(snapshot.billed_amount, currency)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Accounts Receivable</p>
                        <p className="font-medium">{formatCurrency(snapshot.accounts_receivable, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                        <p className="font-medium text-success">{formatCurrency(snapshot.paid_amount, currency)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Updated</p>
                        <p className="font-medium text-muted-foreground">
                          {format(new Date(snapshot.updated_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                    </div>

                    {snapshot.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm italic">{snapshot.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
