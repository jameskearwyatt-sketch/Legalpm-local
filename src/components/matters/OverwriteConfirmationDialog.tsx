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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';

export interface OverwriteConflict {
  matterId: string;
  matterName: string;
  localCounselName: string;
  field: 'wip' | 'billed';
  currentValue: number;
  newValue: number;
  lastManualUpdate: string;
  currency: string;
}

interface OverwriteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSkip: () => void;
  conflicts: OverwriteConflict[];
}

export function OverwriteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  conflicts,
}: OverwriteConfirmationDialogProps) {
  if (conflicts.length === 0) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Manual Update Would Be Overwritten
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                The following local counsel figures were manually updated with more recent data. 
                This bulk import would reduce these values:
              </p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-lg text-sm">
                    <div className="font-medium">{conflict.matterName}</div>
                    <div className="text-muted-foreground text-xs mb-2">
                      {conflict.localCounselName} · {conflict.field === 'wip' ? 'WIP' : 'Billed'}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Current: {formatCurrency(conflict.currentValue, conflict.currency)}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="destructive" className="text-xs">
                        New: {formatCurrency(conflict.newValue, conflict.currency)}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Last manual update: {new Date(conflict.lastManualUpdate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel Import</AlertDialogCancel>
          <AlertDialogAction onClick={onSkip} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Skip These Updates
          </AlertDialogAction>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Overwrite Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
