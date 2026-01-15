import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
} from '@/components/ui/alert-dialog';
import { Loader2, History, Undo2, ChevronDown, ChevronRight, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useMasterWipUpdates, MasterWipSnapshotChange, MasterWipUpdate } from '@/lib/hooks/useMasterWipUpdates';
import { formatCurrency } from '@/lib/currencyUtils';
import { cn } from '@/lib/utils';

interface MasterWipHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  matters: Array<{ id: string; matter_name: string; fee_currency: string }>;
}

export function MasterWipHistoryDialog({
  isOpen,
  onClose,
  matters,
}: MasterWipHistoryDialogProps) {
  const { masterUpdates, isLoading, fetchChangesForUpdate, revertMasterUpdate } = useMasterWipUpdates();
  const [expandedUpdate, setExpandedUpdate] = useState<string | null>(null);
  const [loadedChanges, setLoadedChanges] = useState<Record<string, MasterWipSnapshotChange[]>>({});
  const [loadingChanges, setLoadingChanges] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<MasterWipUpdate | null>(null);

  const getMatterName = (matterId: string) => {
    const matter = matters.find((m) => m.id === matterId);
    return matter?.matter_name || 'Unknown Matter';
  };

  const getMatterCurrency = (matterId: string) => {
    const matter = matters.find((m) => m.id === matterId);
    return matter?.fee_currency || 'GBP';
  };

  const handleToggleExpand = async (update: MasterWipUpdate) => {
    if (expandedUpdate === update.id) {
      setExpandedUpdate(null);
      return;
    }

    setExpandedUpdate(update.id);

    if (!loadedChanges[update.id]) {
      setLoadingChanges(update.id);
      try {
        const changes = await fetchChangesForUpdate(update.id);
        setLoadedChanges((prev) => ({ ...prev, [update.id]: changes }));
      } catch (error) {
        console.error('Failed to load changes:', error);
      } finally {
        setLoadingChanges(null);
      }
    }
  };

  const handleRevert = async () => {
    if (!confirmRevert) return;

    setRevertingId(confirmRevert.id);
    try {
      await revertMasterUpdate.mutateAsync(confirmRevert.id);
      setConfirmRevert(null);
      // Remove from loaded changes since it's been deleted
      setLoadedChanges((prev) => {
        const next = { ...prev };
        delete next[confirmRevert.id];
        return next;
      });
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Master Update History
            </DialogTitle>
            <DialogDescription>
              View past master financial snapshot updates. You can revert any update to restore previous values.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : masterUpdates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No master updates found</p>
                <p className="text-sm mt-1">Master updates will appear here after you import financial data.</p>
              </div>
            ) : (
              <div className="space-y-2 p-1">
                {masterUpdates.map((update) => {
                  const isExpanded = expandedUpdate === update.id;
                  const changes = loadedChanges[update.id] || [];
                  const isLoadingThis = loadingChanges === update.id;
                  const isRevertingThis = revertingId === update.id;

                  return (
                    <div
                      key={update.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Header Row */}
                      <div
                        className={cn(
                          "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          isExpanded && "bg-muted/30"
                        )}
                        onClick={() => handleToggleExpand(update)}
                      >
                        <div className="shrink-0">
                          {isLoadingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(update.created_at), 'dd MMM yyyy, HH:mm')}
                          </span>
                        </div>

                        <Badge variant="secondary">
                          {update.matter_count} matter{update.matter_count !== 1 ? 's' : ''}
                        </Badge>

                        <div className="flex-1" />

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmRevert(update);
                          }}
                          disabled={isRevertingThis}
                          className="text-destructive hover:text-destructive"
                        >
                          {isRevertingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Undo2 className="h-4 w-4 mr-1" />
                          )}
                          Revert
                        </Button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-3">
                          {isLoadingThis ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                          ) : changes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No change details available
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground mb-2">
                                Matters updated in this batch:
                              </p>
                              {changes.map((change) => (
                                <div
                                  key={change.id}
                                  className="flex items-start gap-3 p-2 bg-background rounded border text-sm"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                      {getMatterName(change.matter_id)}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                      <span>
                                        WIP: {formatCurrency(change.before_wip_amount, getMatterCurrency(change.matter_id))}
                                      </span>
                                      <span>
                                        Billed: {formatCurrency(change.before_billed_amount, getMatterCurrency(change.matter_id))}
                                      </span>
                                      <span>
                                        Paid: {formatCurrency(change.before_paid_amount, getMatterCurrency(change.matter_id))}
                                      </span>
                                      <span>
                                        AR: {formatCurrency(change.before_accounts_receivable, getMatterCurrency(change.matter_id))}
                                      </span>
                                    </div>
                                  </div>
                                  <Badge variant={change.was_new_snapshot ? 'default' : 'secondary'} className="shrink-0 text-xs">
                                    {change.was_new_snapshot ? 'New' : 'Updated'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmRevert} onOpenChange={(open) => !open && setConfirmRevert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert Master Update?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore all {confirmRevert?.matter_count} matter(s) to their previous financial snapshot values.
              {confirmRevert && (
                <span className="block mt-2 font-medium">
                  Update from: {format(new Date(confirmRevert.created_at), 'dd MMM yyyy, HH:mm')}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevert}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revertingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Reverting...
                </>
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revert Update
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
