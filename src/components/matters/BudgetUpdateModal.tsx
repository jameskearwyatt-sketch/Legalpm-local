import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useBudgetAmendments } from '@/lib/hooks/useBudgetAmendments';
import { useMatters } from '@/lib/hooks/useMatters';
import { Loader2, History, Sparkles, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BudgetUpdateModalProps {
  matterId: string;
  currentBudget: number;
  currentBmFee: number;
  currentLocalCounsel: number;
  currency: string;
}

export function BudgetUpdateModal({
  matterId,
  currentBudget,
  currentBmFee,
  currentLocalCounsel,
  currency,
}: BudgetUpdateModalProps) {
  const [open, setOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(currentBudget.toString());
  const [newBmFee, setNewBmFee] = useState(currentBmFee.toString());
  const [newLocalCounsel, setNewLocalCounsel] = useState(currentLocalCounsel.toString());
  const [notes, setNotes] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  const { amendments, isLoading, createAmendment } = useBudgetAmendments(matterId);
  const { updateMatter } = useMatters();
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    const symbols: Record<string, string> = {
      GBP: '£',
      USD: '$',
      EUR: '€',
    };
    const symbol = symbols[currency] || currency + ' ';
    return symbol + new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSummarize = async () => {
    if (!pastedText.trim()) {
      toast({
        title: 'No text to summarize',
        description: 'Please paste some text first.',
        variant: 'destructive',
      });
      return;
    }

    setIsSummarizing(true);
    try {
      const newBudgetNum = parseFloat(newBudget.replace(/,/g, '')) || 0;
      const newBmFeeNum = parseFloat(newBmFee.replace(/,/g, '')) || 0;
      
      // Build budget change context
      let budgetChange = '';
      if (newBudgetNum !== currentBudget) {
        budgetChange += `Total budget: ${formatCurrency(currentBudget)} → ${formatCurrency(newBudgetNum)}. `;
      }
      if (newBmFeeNum !== currentBmFee) {
        budgetChange += `BM fee: ${formatCurrency(currentBmFee)} → ${formatCurrency(newBmFeeNum)}. `;
      }

      const { data, error } = await supabase.functions.invoke('summarize-amendment-rationale', {
        body: { 
          text: pastedText,
          budgetChange: budgetChange || undefined,
        },
      });

      if (error) throw error;
      
      if (data?.summary) {
        setNotes(data.summary);
        setPastedText(''); // Clear the pasted text after successful summarization
        toast({
          title: 'Summary generated',
          description: 'The rationale has been summarized and added to notes.',
        });
      } else {
        throw new Error('No summary returned');
      }
    } catch (error) {
      console.error('Error summarizing:', error);
      toast({
        title: 'Failed to summarize',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newBudgetNum = parseFloat(newBudget.replace(/,/g, '')) || 0;
    const newBmFeeNum = parseFloat(newBmFee.replace(/,/g, '')) || 0;
    const newLocalCounselNum = parseFloat(newLocalCounsel.replace(/,/g, '')) || 0;

    // Create amendment record
    await createAmendment.mutateAsync({
      matter_id: matterId,
      previous_budget: currentBudget,
      new_budget: newBudgetNum,
      previous_bm_fee: currentBmFee,
      new_bm_fee: newBmFeeNum,
      previous_local_counsel: currentLocalCounsel,
      new_local_counsel: newLocalCounselNum,
      notes: notes || undefined,
    });

    // Update matter with new values
    await updateMatter.mutateAsync({
      id: matterId,
      fee_amount_upper_end: newBudgetNum,
      bm_fee_component: newBmFeeNum,
      local_counsel_fee: newLocalCounselNum,
    });

    setOpen(false);
    setNotes('');
    setPastedText('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setNewBudget(currentBudget.toString());
      setNewBmFee(currentBmFee.toString());
      setNewLocalCounsel(currentLocalCounsel.toString());
      setNotes('');
      setPastedText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-5 px-2 text-[10px] font-medium"
        >
          Update
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Budget Agreement</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="newBudget">Total Budget</Label>
              <Input
                id="newBudget"
                type="text"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder="Enter new budget"
              />
              <p className="text-xs text-muted-foreground">
                Current: {formatCurrency(currentBudget)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newBmFee">Baker McKenzie Fee</Label>
              <Input
                id="newBmFee"
                type="text"
                value={newBmFee}
                onChange={(e) => setNewBmFee(e.target.value)}
                placeholder="Enter BM fee component"
              />
              <p className="text-xs text-muted-foreground">
                Current: {formatCurrency(currentBmFee)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newLocalCounsel">Local Counsel Fee</Label>
              <Input
                id="newLocalCounsel"
                type="text"
                value={newLocalCounsel}
                onChange={(e) => setNewLocalCounsel(e.target.value)}
                placeholder="Enter local counsel fee"
              />
              <p className="text-xs text-muted-foreground">
                Current: {formatCurrency(currentLocalCounsel)}
              </p>
            </div>

            <div className="space-y-3">
              <Label>Why is this budget being updated?</Label>
              
              {/* Paste correspondence for AI summary */}
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Paste correspondence to auto-generate rationale
                </div>
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste email exchange or client notes here..."
                  rows={3}
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSummarize}
                  disabled={isSummarizing || !pastedText.trim()}
                  className="w-full"
                >
                  {isSummarizing ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  Summarize with AI
                </Button>
              </div>

              {/* Notes/Rationale field */}
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Or type your rationale here..."
                rows={3}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={createAmendment.isPending || updateMatter.isPending}
          >
            {(createAmendment.isPending || updateMatter.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Budget Update
          </Button>
        </form>

        {/* Amendment History */}
        {amendments.length > 0 && (
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="history" className="border-none">
              <AccordionTrigger className="text-sm py-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Budget History ({amendments.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    amendments.map((amendment) => (
                      <div 
                        key={amendment.id} 
                        className="text-xs p-2 bg-muted/50 rounded space-y-1"
                      >
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {format(new Date(amendment.amendment_date), 'dd MMM yyyy')}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(amendment.previous_budget)} → {formatCurrency(amendment.new_budget)}
                          </span>
                        </div>
                        {amendment.notes && (
                          <p className="text-muted-foreground">{amendment.notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
}
