import { useState, useEffect, useMemo } from "react";
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

export interface FeeOwnerHours {
  [key: string]: number;
}

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
  // Hours for each fee owner (first turn only)
  const [feeOwnerHours, setFeeOwnerHours] = useState<FeeOwnerHours>({
    partner: initialHours.partner || 0,
    seniorAssociate: initialHours.seniorAssociate || 0,
    associate: initialHours.associate || 0,
    trainee: initialHours.trainee || 0,
  });
  
  const [numTurns, setNumTurns] = useState(initialTurns);
  const [itemType, setItemType] = useState(initialItemType);

  // Reset when dialog opens with new values
  useEffect(() => {
    if (open) {
      setFeeOwnerHours({
        partner: initialHours.partner || 0,
        seniorAssociate: initialHours.seniorAssociate || 0,
        associate: initialHours.associate || 0,
        trainee: initialHours.trainee || 0,
      });
      setNumTurns(initialTurns);
      setItemType(initialItemType);
    }
  }, [open, initialHours, initialTurns, initialItemType]);

  // Get decay factor based on item type
  const getDecayFactor = () => {
    if (itemType === 'negotiation') return assumptions.negotiatedDocsDecay;
    if (itemType === 'due_diligence') return assumptions.ddDecay;
    return 1; // No decay for documentation/meeting
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
  }, [feeOwnerHours, numTurns, itemType, rateCard, assumptions]);

  const handleApply = () => {
    onApply({
      feeOwnerHours,
      numTurns,
      itemType,
      calculatedFee: calculation.totalFee,
    });
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return `${currencySymbol}${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Iterative Pricing Calculator
          </DialogTitle>
          <DialogDescription>
            {workItemName || 'Configure pricing based on hours, turns, and decay factors'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Instructions */}
          <div className="bg-muted/50 p-4 rounded-lg flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>How it works:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Enter hours for each fee owner for the <strong>first turn</strong></li>
                <li>Select whether this is a process/negotiation or document/due diligence</li>
                <li>Set the number of turns (iterations)</li>
                <li>The calculator applies the decay factor from assumptions for subsequent turns</li>
              </ol>
            </div>
          </div>

          {/* Configuration Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documentation">Documentation (no decay)</SelectItem>
                  <SelectItem value="negotiation">Negotiation/Process ({(assumptions.negotiatedDocsDecay * 100).toFixed(0)}% decay)</SelectItem>
                  <SelectItem value="due_diligence">Due Diligence ({(assumptions.ddDecay * 100).toFixed(0)}% decay)</SelectItem>
                  <SelectItem value="meeting">Meeting (no decay)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Turns</Label>
              <Input
                type="number"
                value={numTurns}
                onChange={(e) => setNumTurns(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
              />
            </div>
          </div>

          {/* Hours Input Table */}
          <div className="space-y-2">
            <Label>Hours per Fee Owner (First Turn)</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">Grade</th>
                    <th className="text-right p-3 text-sm font-medium">Rate</th>
                    <th className="text-right p-3 text-sm font-medium w-28">First Turn Hrs</th>
                    <th className="text-right p-3 text-sm font-medium">Total Hrs</th>
                    <th className="text-right p-3 text-sm font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {calculation.breakdown.map((grade) => (
                    <tr key={grade.key} className="border-t">
                      <td className="p-3 font-medium">{grade.label}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {formatCurrency(grade.effectiveRate)}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={feeOwnerHours[grade.key] || 0}
                          onChange={(e) => setFeeOwnerHours(prev => ({
                            ...prev,
                            [grade.key]: parseFloat(e.target.value) || 0
                          }))}
                          min={0}
                          step={0.5}
                          className="w-24 text-right ml-auto"
                        />
                      </td>
                      <td className="p-3 text-right">
                        {grade.totalHours.toFixed(1)}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(grade.fee)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/30 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3"></td>
                    <td className="p-3"></td>
                    <td className="p-3 text-right">{calculation.totalHours.toFixed(1)}</td>
                    <td className="p-3 text-right">{formatCurrency(calculation.totalFee)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-primary/5 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Calculated Fee</p>
              <p className="text-2xl font-bold">{formatCurrency(calculation.totalFee)}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold">{calculation.totalHours.toFixed(1)}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Margin</p>
              <p className="text-2xl font-bold">{calculation.marginPercent.toFixed(0)}%</p>
            </div>
          </div>

          {numTurns > 1 && calculation.decay < 1 && (
            <p className="text-sm text-muted-foreground">
              * Decay factor of {(calculation.decay * 100).toFixed(0)}% applied. 
              Each subsequent turn uses {(calculation.decay * 100).toFixed(0)}% of the previous turn's hours.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            <Calculator className="h-4 w-4 mr-2" />
            Apply {formatCurrency(calculation.totalFee)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
