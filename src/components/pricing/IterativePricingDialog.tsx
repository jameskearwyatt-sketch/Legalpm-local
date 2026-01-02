import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Info } from "lucide-react";
import { RateCard, ProposalAssumptions } from "@/lib/hooks/usePricingProposals";
import { getCurrencySymbol } from "@/lib/currencyUtils";

export interface FeeOwnerHours {
  [key: string]: number;
}

type DecayOption = '75' | '50' | '25';

interface IterativePricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemName: string;
  rateCard: RateCard;
  assumptions: ProposalAssumptions;
  currencySymbol: string;
  initialHours?: FeeOwnerHours;
  initialTurns?: number;
  initialItemType?: string;
  onApply: (result: {
    feeOwnerHours: FeeOwnerHours;
    numTurns: number;
    itemType: string;
    calculatedFee: number;
  }) => void;
}

export function IterativePricingDialog({
  open,
  onOpenChange,
  workItemName,
  rateCard,
  assumptions,
  currencySymbol,
  initialHours = {},
  initialTurns = 1,
  initialItemType = 'documentation',
  onApply,
}: IterativePricingDialogProps) {
  // Track if user has interacted with this dialog instance
  const hasUserInput = useRef(false);
  
  // Store last user-entered values to persist between close/reopen
  const lastUserValues = useRef<{
    hours: FeeOwnerHours;
    turns: number;
    decay: DecayOption;
  } | null>(null);

  // Hours for each fee owner (first turn only)
  const [feeOwnerHours, setFeeOwnerHours] = useState<FeeOwnerHours>({
    partner: initialHours.partner || 0,
    seniorAssociate: initialHours.seniorAssociate || 0,
    associate: initialHours.associate || 0,
    trainee: initialHours.trainee || 0,
  });
  
  const [numTurns, setNumTurns] = useState(initialTurns);
  const [decayPercent, setDecayPercent] = useState<DecayOption>('75');

  // Track user input
  const handleHoursChange = (key: string, value: number) => {
    hasUserInput.current = true;
    setFeeOwnerHours(prev => ({ ...prev, [key]: value }));
  };

  const handleTurnsChange = (value: number) => {
    hasUserInput.current = true;
    setNumTurns(value);
  };

  const handleDecayChange = (value: DecayOption) => {
    hasUserInput.current = true;
    setDecayPercent(value);
  };

  // Store values when dialog closes
  useEffect(() => {
    if (!open && hasUserInput.current) {
      lastUserValues.current = {
        hours: { ...feeOwnerHours },
        turns: numTurns,
        decay: decayPercent,
      };
    }
  }, [open, feeOwnerHours, numTurns, decayPercent]);

  // Restore values when dialog opens
  useEffect(() => {
    if (open) {
      if (lastUserValues.current) {
        // Restore last user-entered values
        setFeeOwnerHours(lastUserValues.current.hours);
        setNumTurns(lastUserValues.current.turns);
        setDecayPercent(lastUserValues.current.decay);
      } else {
        // First time opening - use initial values
        setFeeOwnerHours({
          partner: initialHours.partner || 0,
          seniorAssociate: initialHours.seniorAssociate || 0,
          associate: initialHours.associate || 0,
          trainee: initialHours.trainee || 0,
        });
        setNumTurns(initialTurns);
        setDecayPercent('75');
      }
    }
  }, [open]);

  // Get decay factor from selected percentage (e.g. 75% decay means each turn takes 25% of the previous)
  const getDecayFactor = () => {
    const percent = parseInt(decayPercent);
    return (100 - percent) / 100; // 75% decay = 0.25 multiplier
  };

  // Calculate total hours with decay
  const calculateTotalHoursWithDecay = (baseHours: number) => {
    const decay = getDecayFactor();
    if (decay === 1 || numTurns === 1) return baseHours * numTurns;
    
    let total = baseHours;
    let currentHours = baseHours;
    for (let i = 1; i < numTurns; i++) {
      currentHours = currentHours * decay;
      total += currentHours;
    }
    return total;
  };

  // Calculate the breakdown and total fee
  const calculation = useMemo(() => {
    const discountMultiplier = 1 - (assumptions.afaDiscount / 100);
    const decay = getDecayFactor();

    const grades = [
      { key: 'partner', label: 'Partner', rate: rateCard.partner?.rate || 0, cost: rateCard.partner?.cost || 0 },
      { key: 'seniorAssociate', label: 'Senior Associate', rate: rateCard.seniorAssociate?.rate || 0, cost: rateCard.seniorAssociate?.cost || 0 },
      { key: 'associate', label: 'Associate', rate: rateCard.associate?.rate || 0, cost: rateCard.associate?.cost || 0 },
      { key: 'trainee', label: 'Trainee', rate: rateCard.trainee?.rate || 0, cost: rateCard.trainee?.cost || 0 },
    ];

    let totalFee = 0;
    let totalHours = 0;
    let totalCost = 0;

    const breakdown = grades.map(grade => {
      const firstTurnHours = feeOwnerHours[grade.key] || 0;
      const totalGradeHours = calculateTotalHoursWithDecay(firstTurnHours);
      const effectiveRate = grade.rate * discountMultiplier;
      const fee = totalGradeHours * effectiveRate;
      const cost = totalGradeHours * grade.cost;
      
      totalFee += fee;
      totalHours += totalGradeHours;
      totalCost += cost;

      return {
        ...grade,
        firstTurnHours,
        totalHours: totalGradeHours,
        effectiveRate,
        fee,
        cost,
      };
    });

    return {
      breakdown,
      totalFee: Math.round(totalFee),
      totalHours,
      totalCost,
      margin: totalFee - totalCost,
      marginPercent: totalFee > 0 ? ((totalFee - totalCost) / totalFee) * 100 : 0,
      decay,
    };
  }, [feeOwnerHours, numTurns, decayPercent, rateCard, assumptions]);

  const handleApply = () => {
    onApply({
      feeOwnerHours,
      numTurns,
      itemType: 'iterative', // Just use a generic type since we removed the type column
      calculatedFee: calculation.totalFee,
    });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" />
            Iterative Pricing Calculator
          </DialogTitle>
          <DialogDescription className="text-sm">
            {workItemName || 'Configure pricing based on hours, turns, and decay factors'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-2">
          {/* Left Column - Configuration */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Number of Turns</Label>
              <Input
                type="number"
                value={numTurns}
                onChange={(e) => handleTurnsChange(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Decay</Label>
              <Select value={decayPercent} onValueChange={(v) => handleDecayChange(v as DecayOption)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="75">75% decay</SelectItem>
                  <SelectItem value="50">50% decay</SelectItem>
                  <SelectItem value="25">25% decay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground">
              <p className="font-medium mb-1">Decay explained:</p>
              <p>{decayPercent}% decay means turn 2 takes {decayPercent}% less time than turn 1, turn 3 takes {decayPercent}% less time than turn 2, and so on.</p>
            </div>
          </div>

          {/* Middle Column - Hours Input */}
          <div className="space-y-2">
            <Label className="text-xs">Hours (First Turn)</Label>
            <div className="space-y-1.5">
              {calculation.breakdown.map((grade) => (
                <div key={grade.key} className="flex items-center gap-2">
                  <span className="text-xs w-20 truncate">{grade.label}</span>
                  <Input
                    type="number"
                    value={feeOwnerHours[grade.key] || 0}
                    onChange={(e) => handleHoursChange(grade.key, parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.5}
                    className="w-16 h-7 text-right text-sm"
                  />
                  <span className="text-xs text-muted-foreground">→ {grade.totalHours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-2">
            <Label className="text-xs">Breakdown</Label>
            <div className="space-y-1.5">
              {calculation.breakdown.filter(g => g.fee > 0).map((grade) => (
                <div key={grade.key} className="flex justify-between text-xs">
                  <span>{grade.label}</span>
                  <span className="font-medium">{formatCurrency(grade.fee)}</span>
                </div>
              ))}
              <div className="border-t pt-1.5 mt-1.5 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span>{formatCurrency(calculation.totalFee)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="bg-primary/10 p-2 rounded text-center">
                <p className="text-[10px] text-muted-foreground">Fee</p>
                <p className="text-sm font-bold">{formatCurrency(calculation.totalFee)}</p>
              </div>
              <div className="bg-muted/50 p-2 rounded text-center">
                <p className="text-[10px] text-muted-foreground">Hours</p>
                <p className="text-sm font-bold">{calculation.totalHours.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {numTurns > 1 && calculation.decay < 1 && (
          <p className="text-xs text-muted-foreground">
            Decay: {(calculation.decay * 100).toFixed(0)}% per turn
          </p>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply {formatCurrency(calculation.totalFee)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
