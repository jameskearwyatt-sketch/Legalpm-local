import { useState } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Lightbulb, 
  Archive, 
  Trash2, 
  ChevronDown, 
  Pencil, 
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatCurrency } from '@/lib/currencyUtils';
import { WipShapingProposal } from '@/lib/hooks/useWipShapingProposals';
import { cn } from '@/lib/utils';

interface WipShapingProposalListProps {
  isOpen: boolean;
  onClose: () => void;
  activeProposals: WipShapingProposal[];
  archivedProposals: WipShapingProposal[];
  selectedProposal: WipShapingProposal | null;
  currency: string;
  onSelect: (proposalId: string | null) => void;
  onArchive: (proposalId: string) => void;
  onDelete: (proposalId: string) => void;
  onEdit: (proposal: WipShapingProposal) => void;
}

export function WipShapingProposalList({
  isOpen,
  onClose,
  activeProposals,
  archivedProposals,
  selectedProposal,
  currency,
  onSelect,
  onArchive,
  onDelete,
  onEdit,
}: WipShapingProposalListProps) {
  const [showArchived, setShowArchived] = useState(false);

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd MMM yyyy');
  };

  const renderProposalCard = (proposal: WipShapingProposal, isArchived = false) => {
    const netWip = proposal.wip_amount - proposal.wip_write_off_amount;
    const rawAr = proposal.accounts_receivable + proposal.ar_write_off_amount;
    const netAr = proposal.accounts_receivable;
    const isSelected = selectedProposal?.id === proposal.id;

    return (
      <div 
        key={proposal.id} 
        className={cn(
          "p-4 rounded-lg border transition-all",
          isSelected 
            ? "bg-amber-500/10 border-amber-500/50 ring-2 ring-amber-500/30" 
            : "bg-muted/30 hover:bg-muted/50",
          isArchived && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">
                {formatDate(proposal.proposal_date)}
              </span>
              {isSelected && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="text-xs">
                  Archived
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {proposal.notes}
            </p>
            
            {/* Financial Summary - WIP on left, AR on right */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {/* Left column: WIP figures */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raw WIP:</span>
                  <span>{formatCurrency(proposal.wip_amount, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-destructive">WIP W/O:</span>
                  <span className="text-destructive">({formatCurrency(proposal.wip_write_off_amount, currency)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Net WIP:</span>
                  <span className="font-medium">{formatCurrency(netWip, currency)}</span>
                </div>
              </div>
              
              {/* Right column: AR figures */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raw AR:</span>
                  <span>{formatCurrency(rawAr, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={proposal.ar_write_off_amount > 0 ? 'text-destructive' : proposal.ar_write_off_amount < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                    {proposal.ar_write_off_amount < 0 ? 'AR Inc:' : 'AR W/O:'}
                  </span>
                  <span className={proposal.ar_write_off_amount > 0 ? 'text-destructive' : proposal.ar_write_off_amount < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                    {proposal.ar_write_off_amount > 0 
                      ? `(${formatCurrency(proposal.ar_write_off_amount, currency)})`
                      : proposal.ar_write_off_amount < 0
                        ? `+${formatCurrency(Math.abs(proposal.ar_write_off_amount), currency)}`
                        : formatCurrency(0, currency)
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Net AR:</span>
                  <span className="font-medium">{formatCurrency(netAr, currency)}</span>
                </div>
              </div>
            </div>
            
            {/* Paid amount */}
            <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Paid:</span>
              <span className="text-success font-medium">{formatCurrency(proposal.paid_amount, currency)}</span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1">
            {!isArchived && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => onSelect(isSelected ? null : proposal.id)}
                  title={isSelected ? "Deselect proposal" : "Select as current proposal"}
                >
                  {isSelected ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-amber-500" />
                  )}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => onEdit(proposal)}
                  title="Edit proposal"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => onArchive(proposal.id)}
                  title="Archive proposal"
                >
                  <Archive className="h-4 w-4 text-muted-foreground" />
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  title="Delete proposal"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this WIP shaping proposal. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(proposal.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            WIP Shaping Proposals
          </DialogTitle>
          <DialogDescription>
            View and manage your WIP shaping proposals. Select a proposal to see its figures instead of the actual snapshot.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {activeProposals.length === 0 && archivedProposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No WIP shaping proposals yet</p>
              <p className="text-xs mt-1">Create a proposal to explore different scenarios</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Proposals */}
              {activeProposals.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Active Proposals ({activeProposals.length})
                  </h4>
                  {activeProposals.map(p => renderProposalCard(p))}
                </div>
              )}

              {/* Archived Proposals */}
              {archivedProposals.length > 0 && (
                <Collapsible open={showArchived} onOpenChange={setShowArchived}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                      <span>Archived ({archivedProposals.length})</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform",
                        showArchived && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 mt-2">
                    {archivedProposals.map(p => renderProposalCard(p, true))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
