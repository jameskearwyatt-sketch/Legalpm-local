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
import { Loader2, Info, Lightbulb, Sparkles, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { WipShapingProposal } from '@/lib/hooks/useWipShapingProposals';
import { LocalCounsel } from '@/lib/hooks/useLocalCounsels';
import { LocalCounselProposalData, initializeProposalLcData, proposalLcToFormData, ProposalLocalCounsel } from '@/lib/hooks/useProposalLocalCounsels';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WipShapingProposalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    wip_amount: number;
    wip_write_off_amount: number;
    ar_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
    lc_wip_amount: number;
    lc_billed_amount: number;
    notes: string;
  }, localCounselData: LocalCounselProposalData[]) => Promise<void>;
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
  localCounsels?: LocalCounsel[];
  existingProposalLocalCounsels?: ProposalLocalCounsel[];
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
  localCounsels = [],
  existingProposalLocalCounsels = [],
}: WipShapingProposalDialogProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showAiHelper, setShowAiHelper] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>('writeoff');
  
  // Use strings for controlled inputs to avoid number parsing issues
  const [formData, setFormData] = useState({
    // Raw values (starting points)
    raw_wip: '0',
    raw_ar: '0',
    // Write-off amounts (used when entryMode === 'writeoff')
    wip_write_off: '0',
    ar_write_off: '0',
    // Adjusted amounts (used when entryMode === 'adjusted')
    adjusted_wip: '0',
    adjusted_ar: '0',
    // Other fields
    paid_amount: '0',
    notes: '',
  });

  // Parse string values to numbers for calculations
  const numericValues = {
    raw_wip: parseFloat(formData.raw_wip) || 0,
    raw_ar: parseFloat(formData.raw_ar) || 0,
    wip_write_off: parseFloat(formData.wip_write_off) || 0,
    ar_write_off: parseFloat(formData.ar_write_off) || 0,
    adjusted_wip: parseFloat(formData.adjusted_wip) || 0,
    adjusted_ar: parseFloat(formData.adjusted_ar) || 0,
    paid_amount: parseFloat(formData.paid_amount) || 0,
  };

  // Local counsel form data - per-firm adjustments
  const [lcFormData, setLcFormData] = useState<LocalCounselProposalData[]>([]);

  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (existingProposal) {
        // Editing existing proposal - use stored values directly
        const rawWip = roundTo2(existingProposal.wip_amount);
        const wipWriteOff = roundTo2(existingProposal.wip_write_off_amount);
        // Use the stored ar_write_off_amount directly instead of recalculating
        const arWriteOff = roundTo2(existingProposal.ar_write_off_amount || 0);
        // Raw AR = adjusted AR + AR write-off (reverse calculation to get raw)
        const adjustedAr = roundTo2(existingProposal.accounts_receivable);
        const rawAr = roundTo2(adjustedAr + arWriteOff);
        
        setFormData({
          raw_wip: String(rawWip),
          raw_ar: String(rawAr),
          wip_write_off: String(wipWriteOff),
          ar_write_off: String(arWriteOff),
          adjusted_wip: String(roundTo2(rawWip - wipWriteOff)),
          adjusted_ar: String(adjustedAr),
          paid_amount: String(roundTo2(existingProposal.paid_amount)),
          notes: existingProposal.notes || '',
        });

        // Load existing local counsel proposal data if available
        if (existingProposalLocalCounsels.length > 0) {
          setLcFormData(proposalLcToFormData(existingProposalLocalCounsels));
        } else {
          // Initialize from current local counsels
          setLcFormData(initializeProposalLcData(localCounsels));
        }
      } else {
        // New proposal - pre-fill with current snapshot values
        const rawWip = roundTo2(currentValues?.wip_amount || 0);
        const wipWriteOff = roundTo2(currentValues?.wip_write_off_amount || 0);
        const rawAr = roundTo2(currentValues?.billed_amount || currentValues?.accounts_receivable || 0);
        const currentAr = roundTo2(currentValues?.accounts_receivable || 0);
        const arWriteOff = roundTo2(Math.max(0, rawAr - currentAr));
        
        setFormData({
          raw_wip: String(rawWip),
          raw_ar: String(rawAr),
          wip_write_off: String(wipWriteOff),
          ar_write_off: String(arWriteOff),
          adjusted_wip: String(roundTo2(rawWip - wipWriteOff)),
          adjusted_ar: String(currentAr),
          paid_amount: String(roundTo2(currentValues?.paid_amount || 0)),
          notes: '',
        });

        // Initialize local counsel data from current values
        setLcFormData(initializeProposalLcData(localCounsels));
      }
      setEntryMode('writeoff');
      setPastedText('');
      setShowAiHelper(false);
    }
  }, [isOpen, currentValues, existingProposal, localCounsels, existingProposalLocalCounsels]);

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
  const calculatedValues = useMemo(() => {
    let finalWipWriteOff: number;
    let finalArWriteOff: number;
    let finalAdjustedWip: number;
    let finalAdjustedAr: number;

    if (entryMode === 'writeoff') {
      finalWipWriteOff = numericValues.wip_write_off;
      finalArWriteOff = numericValues.ar_write_off;
      finalAdjustedWip = numericValues.raw_wip - numericValues.wip_write_off;
      finalAdjustedAr = numericValues.raw_ar - numericValues.ar_write_off;
    } else {
      finalAdjustedWip = numericValues.adjusted_wip;
      finalAdjustedAr = numericValues.adjusted_ar;
      finalWipWriteOff = numericValues.raw_wip - numericValues.adjusted_wip;
      finalArWriteOff = numericValues.raw_ar - numericValues.adjusted_ar;
    }

    const totalWriteOff = roundTo2(finalWipWriteOff + finalArWriteOff);
    const calculatedBilledAmount = roundTo2(numericValues.paid_amount + finalAdjustedAr);

    return {
      wipWriteOff: roundTo2(finalWipWriteOff),
      arWriteOff: roundTo2(finalArWriteOff),
      adjustedWip: roundTo2(finalAdjustedWip),
      adjustedAr: roundTo2(finalAdjustedAr),
      totalWriteOff,
      billedAmount: calculatedBilledAmount,
    };
  }, [entryMode, numericValues]);

  // Calculate LC totals from individual LC form data
  const lcTotals = useMemo(() => {
    const totalProposedWip = lcFormData.reduce((sum, lc) => sum + lc.proposed_wip_amount, 0);
    const totalProposedBilled = lcFormData.reduce((sum, lc) => sum + lc.proposed_billed_amount, 0);
    const totalWipWriteOff = lcFormData.reduce((sum, lc) => sum + (lc.raw_wip_amount - lc.proposed_wip_amount), 0);
    const totalBilledWriteOff = lcFormData.reduce((sum, lc) => sum + (lc.raw_billed_amount - lc.proposed_billed_amount), 0);
    return {
      totalProposedWip: roundTo2(totalProposedWip),
      totalProposedBilled: roundTo2(totalProposedBilled),
      totalWipWriteOff: roundTo2(totalWipWriteOff),
      totalBilledWriteOff: roundTo2(totalBilledWriteOff),
      totalWriteOff: roundTo2(totalWipWriteOff + totalBilledWriteOff),
    };
  }, [lcFormData]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateLcField = (lcId: string, field: 'proposed_wip_amount' | 'proposed_billed_amount', value: number) => {
    setLcFormData(prev => prev.map(lc => 
      lc.local_counsel_id === lcId ? { ...lc, [field]: value } : lc
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.notes.trim()) {
      return; // Notes are required
    }
    
    setIsSubmitting(true);
    try {
      await onSave({
        wip_amount: numericValues.raw_wip,
        wip_write_off_amount: calculatedValues.wipWriteOff,
        ar_write_off_amount: calculatedValues.arWriteOff,
        billed_amount: calculatedValues.billedAmount,
        accounts_receivable: calculatedValues.adjustedAr,
        paid_amount: numericValues.paid_amount,
        lc_wip_amount: lcTotals.totalProposedWip,
        lc_billed_amount: lcTotals.totalProposedBilled,
        notes: formData.notes.trim(),
      }, lcFormData);
      onClose();
    } catch (error) {
      console.error('Failed to save proposal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    onChange={(e) => updateField('raw_wip', e.target.value)}
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
                        max={numericValues.raw_wip}
                        step="0.01"
                        value={formData.wip_write_off}
                        onChange={(e) => updateField('wip_write_off', e.target.value)}
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
                        onChange={(e) => updateField('adjusted_wip', e.target.value)}
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
                    onChange={(e) => updateField('raw_ar', e.target.value)}
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
                        max={numericValues.raw_ar}
                        step="0.01"
                        value={formData.ar_write_off}
                        onChange={(e) => updateField('ar_write_off', e.target.value)}
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
                        onChange={(e) => updateField('adjusted_ar', e.target.value)}
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

            {/* Paid Amount & Total Billed */}
            <div className="pt-3 border-t border-border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="paid_amount" className="text-xs">Total Paid ({currencySymbol.trim()})</Label>
                  <Input
                    id="paid_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.paid_amount}
                    onChange={(e) => updateField('paid_amount', e.target.value)}
                    className="h-9"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Fixed from financial records</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Total Billed (Auto-calculated)</Label>
                  <div className="h-9 px-3 py-2 bg-muted rounded-md border flex items-center font-medium text-sm">
                    {formatCurrency(calculatedValues.billedAmount, currency)}
                  </div>
                  <p className="text-xs text-muted-foreground">= Paid + Adjusted AR</p>
                </div>
              </div>
            </div>
          </div>

          {/* Local Counsel Section - Individual firms */}
          {hasLocalCounsel && localCounsels.length > 0 && (
            <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Local Counsel</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Adjust WIP and Billed amounts for each local counsel firm. These are proposals only and won't change actual figures.
              </p>
              
              <div className="space-y-3">
                {lcFormData.map((lc) => (
                  <div key={lc.local_counsel_id} className="p-3 bg-background rounded-md border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{lc.firm_name}</span>
                      <span className="text-xs text-muted-foreground">
                        Raw: WIP {formatCurrency(lc.raw_wip_amount, currency)} | Billed {formatCurrency(lc.raw_billed_amount, currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Proposed WIP ({currencySymbol.trim()})</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lc.proposed_wip_amount}
                          onChange={(e) => updateLcField(lc.local_counsel_id, 'proposed_wip_amount', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Proposed Billed ({currencySymbol.trim()})</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={lc.proposed_billed_amount}
                          onChange={(e) => updateLcField(lc.local_counsel_id, 'proposed_billed_amount', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* Show write-off for this LC */}
                    {(lc.raw_wip_amount !== lc.proposed_wip_amount || lc.raw_billed_amount !== lc.proposed_billed_amount) && (
                      <div className="mt-2 pt-2 border-t border-border/50 flex justify-between text-xs">
                        <span className="text-muted-foreground">Write-off:</span>
                        <span className="text-destructive font-medium">
                          WIP: {formatCurrency(lc.raw_wip_amount - lc.proposed_wip_amount, currency)} | 
                          Billed: {formatCurrency(lc.raw_billed_amount - lc.proposed_billed_amount, currency)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* LC Totals */}
              <div className="pt-3 border-t border-primary/20">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total LC WIP:</span>
                    <span className="font-medium">{formatCurrency(lcTotals.totalProposedWip, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total LC Billed:</span>
                    <span className="font-medium">{formatCurrency(lcTotals.totalProposedBilled, currency)}</span>
                  </div>
                </div>
                {lcTotals.totalWriteOff !== 0 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-primary/20">
                    <span className="text-sm font-medium">Total LC Write-off:</span>
                    <span className={`font-bold ${lcTotals.totalWriteOff < 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {lcTotals.totalWriteOff < 0 
                        ? `+${formatCurrency(Math.abs(lcTotals.totalWriteOff), currency)}`
                        : formatCurrency(lcTotals.totalWriteOff, currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fallback for matters with LC flag but no individual LC records */}
          {hasLocalCounsel && localCounsels.length === 0 && (
            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This matter has a local counsel budget but no individual local counsel firms have been configured yet. 
                Add local counsel firms in the matter details to enable per-firm WIP shaping proposals.
              </AlertDescription>
            </Alert>
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
