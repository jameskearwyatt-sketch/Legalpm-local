import { useState, useMemo, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Info, Lightbulb, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { WipShapingProposal } from '@/lib/hooks/useWipShapingProposals';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WipShapingProposalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    lc_wip_amount: number;
    lc_billed_amount: number;
    notes: string;
  }) => Promise<void>;
  currency: string;
  currentValues?: {
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    lc_wip_amount: number;
    lc_billed_amount: number;
  };
  matterName?: string;
  differentBillingCurrency?: boolean;
  quoteCurrency?: string;
  existingProposal?: WipShapingProposal | null;
  hasLocalCounsel?: boolean;
}

type EntryMode = 'writeoff' | 'adjusted';

export function WipShapingProposalDialog({
  isOpen,
  onClose,
  onSave,
  currency,
  currentValues,
  matterName,
  differentBillingCurrency,
  quoteCurrency,
  existingProposal,
  hasLocalCounsel = false,
}: WipShapingProposalDialogProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>('writeoff');
  
  const [formData, setFormData] = useState({
    // Raw values (starting points)
    raw_wip: 0,
    raw_ar: 0,
    // Write-off amounts (used when entryMode === 'writeoff')
    wip_write_off: 0,
    ar_write_off: 0,
    // Adjusted amounts (used when entryMode === 'adjusted')
    adjusted_wip: 0,
    adjusted_ar: 0,
    // Other fields
    paid_amount: 0,
    lc_wip_amount: 0,
    lc_billed_amount: 0,
    notes: '',
  });

  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (existingProposal) {
        // Editing existing proposal
        const rawWip = roundTo2(existingProposal.wip_amount);
        const wipWriteOff = roundTo2(existingProposal.wip_write_off_amount);
        // For AR, we need to calculate from billed - AR (where billed = raw AR before write-off)
        // If billed_amount exists and is > accounts_receivable, the difference is the AR write-off
        const rawAr = roundTo2(existingProposal.billed_amount || existingProposal.accounts_receivable);
        const arWriteOff = roundTo2(Math.max(0, rawAr - existingProposal.accounts_receivable));
        
        setFormData({
          raw_wip: rawWip,
          raw_ar: rawAr,
          wip_write_off: wipWriteOff,
          ar_write_off: arWriteOff,
          adjusted_wip: roundTo2(rawWip - wipWriteOff),
          adjusted_ar: roundTo2(existingProposal.accounts_receivable),
          paid_amount: roundTo2(existingProposal.paid_amount),
          lc_wip_amount: roundTo2(existingProposal.lc_wip_amount || 0),
          lc_billed_amount: roundTo2(existingProposal.lc_billed_amount || 0),
          notes: existingProposal.notes || '',
        });
      } else {
        // New proposal - pre-fill with current snapshot values
        const rawWip = roundTo2(currentValues?.wip_amount || 0);
        const wipWriteOff = roundTo2(currentValues?.wip_write_off_amount || 0);
        // For AR, use billed_amount as raw AR (bills issued) and accounts_receivable as current AR
        const rawAr = roundTo2(currentValues?.billed_amount || currentValues?.accounts_receivable || 0);
        const currentAr = roundTo2(currentValues?.accounts_receivable || 0);
        const arWriteOff = roundTo2(Math.max(0, rawAr - currentAr));
        
        setFormData({
          raw_wip: rawWip,
          raw_ar: rawAr,
          wip_write_off: wipWriteOff,
          ar_write_off: arWriteOff,
          adjusted_wip: roundTo2(rawWip - wipWriteOff),
          adjusted_ar: currentAr,
          paid_amount: roundTo2(currentValues?.paid_amount || 0),
          lc_wip_amount: roundTo2(currentValues?.lc_wip_amount || 0),
          lc_billed_amount: roundTo2(currentValues?.lc_billed_amount || 0),
          notes: '',
        });
      }
      setEntryMode('writeoff');
      setPastedText('');
      setShowAiHelper(false);
    }
  }, [isOpen, currentValues, existingProposal]);

  const handleAiSummarize = async () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some text to summarize');
      return;
    }

    setIsSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('summarize-wip-proposal', {
        body: { text: pastedText, matterName },
      });

      if (error) {
        console.error('Summarization error:', error);
        toast.error(error.message || 'Failed to summarize text');
        return;
      }

      if (data?.summary) {
        updateField('notes', data.summary);
        setPastedText('');
        setShowAiHelper(false);
        toast.success('Summary generated and added to description');
      } else {
        toast.error('No summary was generated');
      }
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Failed to summarize text');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Calculate derived values based on entry mode
  // Note: Write-offs can be negative (meaning an increase from raw value)
  // e.g., WIP 3000 → 5000 = -2000 write-off (increase)
  //       AR 10000 → 5000 = +5000 write-off (decrease)
  //       Total = 3000 net write-off
  const calculatedValues = useMemo(() => {
    let finalWipWriteOff: number;
    let finalArWriteOff: number;
    let finalAdjustedWip: number;
    let finalAdjustedAr: number;

    if (entryMode === 'writeoff') {
      // User entered write-offs, calculate adjusted values
      // Write-offs can be negative (meaning an increase)
      finalWipWriteOff = formData.wip_write_off;
      finalArWriteOff = formData.ar_write_off;
      finalAdjustedWip = formData.raw_wip - formData.wip_write_off;
      finalAdjustedAr = formData.raw_ar - formData.ar_write_off;
    } else {
      // User entered adjusted values, calculate write-offs
      // Write-off = raw - adjusted (can be negative if adjusted > raw)
      finalAdjustedWip = formData.adjusted_wip;
      finalAdjustedAr = formData.adjusted_ar;
      finalWipWriteOff = formData.raw_wip - formData.adjusted_wip;
      finalArWriteOff = formData.raw_ar - formData.adjusted_ar;
    }

    const totalWriteOff = roundTo2(finalWipWriteOff + finalArWriteOff);

    return {
      wipWriteOff: roundTo2(finalWipWriteOff),
      arWriteOff: roundTo2(finalArWriteOff),
      adjustedWip: roundTo2(finalAdjustedWip),
      adjustedAr: roundTo2(finalAdjustedAr),
      totalWriteOff,
    };
  }, [entryMode, formData.raw_wip, formData.raw_ar, formData.wip_write_off, formData.ar_write_off, formData.adjusted_wip, formData.adjusted_ar]);

  const updateField = (field: string, value: number | string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.notes.trim()) {
      return; // Notes are required
    }
    
    setIsSubmitting(true);
    try {
      // Map to the expected save format
      // wip_amount = raw WIP (unchanged)
      // wip_write_off_amount = TOTAL write-off (WIP + AR combined)
      // billed_amount = raw AR (original billed amount before any AR write-off)
      // accounts_receivable = adjusted AR after write-off
      await onSave({
        wip_amount: formData.raw_wip,
        wip_write_off_amount: calculatedValues.totalWriteOff, // Combined write-off
        billed_amount: formData.raw_ar, // Store raw AR as billed_amount
        accounts_receivable: calculatedValues.adjustedAr,
        paid_amount: formData.paid_amount,
        lc_wip_amount: formData.lc_wip_amount,
        lc_billed_amount: formData.lc_billed_amount,
        notes: formData.notes.trim(),
      });
      onClose();
    } catch (error) {
      console.error('Failed to save proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {existingProposal ? 'Edit WIP Shaping Proposal' : 'Add WIP Shaping Proposal'}
          </DialogTitle>
          <DialogDescription>
            {matterName 
              ? `Propose how WIP and AR could be shaped for ${matterName}` 
              : 'Create a proposal for how WIP and AR could be reshaped'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info Alert */}
          <Alert className="bg-amber-500/10 border-amber-500/30">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              This is a <strong>proposal</strong> — it won't affect the actual financial snapshot until you explicitly apply it.
            </AlertDescription>
          </Alert>

          {/* Currency Note for different billing currency matters */}
          {differentBillingCurrency && quoteCurrency && quoteCurrency !== currency && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Important:</strong> Enter amounts in the <strong>billing currency ({currency})</strong>, not the quote currency ({quoteCurrency}).
              </AlertDescription>
            </Alert>
          )}

          {/* Notes Field - Required */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-sm font-medium">
                Proposal Description <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAiHelper(!showAiHelper)}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="h-3 w-3" />
                AI Summarize
                {showAiHelper ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>

            {/* AI Helper Section */}
            <Collapsible open={showAiHelper}>
              <CollapsibleContent className="space-y-2 pb-2">
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste email chains or notes below and AI will summarize them into a professional description.
                  </p>
                  <Textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste email correspondence or notes here..."
                    rows={4}
                    className="text-sm"
                    disabled={isSummarizing}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAiSummarize}
                    disabled={isSummarizing || !pastedText.trim()}
                    className="w-full"
                  >
                    {isSummarizing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Summarizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-3 w-3" />
                        Generate Summary
                      </>
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="e.g., Client agreed to 20% write-off in exchange for faster payment..."
              rows={2}
              className="text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">
              Describe what this proposal represents for future reference
            </p>
          </div>

          {/* Entry Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <span className="text-sm font-medium">Entry Method</span>
            <RadioGroup
              value={entryMode}
              onValueChange={(value) => setEntryMode(value as EntryMode)}
              className="flex items-center gap-4"
            >
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="writeoff" id="mode-writeoff" className="h-3 w-3" />
                <Label htmlFor="mode-writeoff" className="text-xs cursor-pointer">Enter Write-offs</Label>
              </div>
              <div className="flex items-center space-x-1.5">
                <RadioGroupItem value="adjusted" id="mode-adjusted" className="h-3 w-3" />
                <Label htmlFor="mode-adjusted" className="text-xs cursor-pointer">Enter Revised Amounts</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Baker McKenzie Section */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <h4 className="text-sm font-medium">Baker McKenzie</h4>
            
            {/* WIP Row */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Work in Progress (Time Costs)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="raw_wip" className="text-xs">Raw WIP ({currencySymbol.trim()})</Label>
                  <Input
                    id="raw_wip"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.raw_wip}
                    onChange={(e) => updateField('raw_wip', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>

                {entryMode === 'writeoff' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="wip_write_off" className="text-xs text-destructive">WIP Write-off ({currencySymbol.trim()})</Label>
                      <Input
                        id="wip_write_off"
                        type="number"
                        min="0"
                        max={formData.raw_wip}
                        step="0.01"
                        value={formData.wip_write_off}
                        onChange={(e) => updateField('wip_write_off', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Revised WIP</Label>
                      <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                        {formatCurrency(calculatedValues.adjustedWip, currency)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="adjusted_wip" className="text-xs text-primary">Revised WIP ({currencySymbol.trim()})</Label>
                      <Input
                        id="adjusted_wip"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.adjusted_wip}
                        onChange={(e) => updateField('adjusted_wip', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={`text-xs ${calculatedValues.wipWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculatedValues.wipWriteOff < 0 ? 'WIP Increase' : 'WIP Write-off'}
                      </Label>
                      <div className={`h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm ${calculatedValues.wipWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculatedValues.wipWriteOff < 0 
                          ? `+${formatCurrency(Math.abs(calculatedValues.wipWriteOff), currency)}`
                          : formatCurrency(calculatedValues.wipWriteOff, currency)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* AR Row */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Accounts Receivable (Bills Issued)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="raw_ar" className="text-xs">Bills Issued ({currencySymbol.trim()})</Label>
                  <Input
                    id="raw_ar"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.raw_ar}
                    onChange={(e) => updateField('raw_ar', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>

                {entryMode === 'writeoff' ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="ar_write_off" className="text-xs text-destructive">AR Write-off ({currencySymbol.trim()})</Label>
                      <Input
                        id="ar_write_off"
                        type="number"
                        min="0"
                        max={formData.raw_ar}
                        step="0.01"
                        value={formData.ar_write_off}
                        onChange={(e) => updateField('ar_write_off', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Revised AR</Label>
                      <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                        {formatCurrency(calculatedValues.adjustedAr, currency)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="adjusted_ar" className="text-xs text-primary">Revised AR ({currencySymbol.trim()})</Label>
                      <Input
                        id="adjusted_ar"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.adjusted_ar}
                        onChange={(e) => updateField('adjusted_ar', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={`text-xs ${calculatedValues.arWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculatedValues.arWriteOff < 0 ? 'AR Increase' : 'AR Write-off'}
                      </Label>
                      <div className={`h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm ${calculatedValues.arWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {calculatedValues.arWriteOff < 0 
                          ? `+${formatCurrency(Math.abs(calculatedValues.arWriteOff), currency)}`
                          : formatCurrency(calculatedValues.arWriteOff, currency)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Total Write-off Summary */}
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {calculatedValues.totalWriteOff < 0 ? 'Net Value Increase' : 'Net Write-off'} (WIP + AR)
                </span>
                <span className={`text-lg font-bold ${calculatedValues.totalWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {calculatedValues.totalWriteOff < 0 
                    ? `+${formatCurrency(Math.abs(calculatedValues.totalWriteOff), currency)}`
                    : formatCurrency(calculatedValues.totalWriteOff, currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {calculatedValues.totalWriteOff < 0 
                  ? 'Net increase in value (WIP increase exceeds AR write-off)'
                  : 'WIP write-offs are time cost adjustments. AR write-offs require cancelling and reissuing bills.'}
              </p>
            </div>

            {/* Paid Amount */}
            <div className="pt-3 border-t border-border">
              <div className="space-y-1.5">
                <Label htmlFor="paid_amount" className="text-xs">Total Paid ({currencySymbol.trim()})</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.paid_amount}
                  onChange={(e) => updateField('paid_amount', parseFloat(e.target.value) || 0)}
                  className="h-9 max-w-[200px]"
                />
              </div>
            </div>
          </div>

          {/* Local Counsel Section - only show if matter has local counsel */}
          {hasLocalCounsel && (
            <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="text-sm font-medium">Local Counsel</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lc_wip_amount" className="text-xs">LC WIP ({currencySymbol.trim()})</Label>
                  <Input
                    id="lc_wip_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.lc_wip_amount}
                    onChange={(e) => updateField('lc_wip_amount', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lc_billed_amount" className="text-xs">LC Billed ({currencySymbol.trim()})</Label>
                  <Input
                    id="lc_billed_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.lc_billed_amount}
                    onChange={(e) => updateField('lc_billed_amount', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !formData.notes.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : existingProposal ? (
                'Update Proposal'
              ) : (
                'Save Proposal'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
