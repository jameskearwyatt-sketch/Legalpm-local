import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Users } from "lucide-react";
import { RateCard } from "@/lib/hooks/usePricingProposals";
import { getCurrencySymbol } from "@/lib/currencyUtils";

// Fee earner levels
const LEVELS = [
  { value: "partner", label: "Partner" },
  { value: "counsel", label: "Counsel" },
  { value: "seniorAssociate", label: "Senior Associate" },
  { value: "associate", label: "Associate" },
  { value: "trainee", label: "Trainee" },
] as const;

type LevelValue = typeof LEVELS[number]["value"];

interface FeeEarner {
  key: string;
  level: LevelValue;
  label: string;
  teamRate: number; // Base rate in TEAM CURRENCY (from settings)
  feeRate: number;  // Rate in FEE CURRENCY (used for calculations)
  feeRateOverridden: boolean; // Whether user has manually edited fee rate
}

// Default labels with numbered suffix
const DEFAULT_LABELS: Record<string, string> = {
  partner: "Partner 1",
  counsel: "Counsel 1",
  seniorAssociate: "Senior Associate 1",
  associate: "Associate 1",
  trainee: "Trainee 1",
};

// Convert RateCard to array format for dynamic editing
// rateCard stores rates in TEAM CURRENCY
function rateCardToArray(rateCard: RateCard, exchangeRate: number): FeeEarner[] {
  return Object.entries(rateCard).map(([key, value]) => {
    // Use stored level if available, otherwise auto-detect from key
    let level: LevelValue = (value.level as LevelValue) || "associate";
    if (!value.level) {
      if (key.includes("partner") || key.startsWith("partner")) level = "partner";
      else if (key.includes("counsel") || key.startsWith("counsel")) level = "counsel";
      else if (key.includes("seniorAssociate") || key.startsWith("seniorAssociate")) level = "seniorAssociate";
      else if (key.includes("trainee") || key.startsWith("trainee")) level = "trainee";
      else if (key.includes("associate") || key.startsWith("associate")) level = "associate";
    }
    
    const teamRate = value.rate;
    const feeRate = Math.round(teamRate * exchangeRate);
    
    return {
      key,
      level,
      label: value.label || DEFAULT_LABELS[key] || formatLabel(key),
      teamRate,
      feeRate,
      feeRateOverridden: false,
    };
  });
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function generateKey(level: string, label: string): string {
  const baseKey = label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${level}_${baseKey}_${suffix}`;
}

// Convert array back to RateCard format
// We store the TEAM RATE in the rate card (the user's base rates)
function arrayToRateCard(feeEarners: FeeEarner[]): RateCard {
  const result: RateCard = {} as RateCard;
  feeEarners.forEach(earner => {
    (result as any)[earner.key] = { rate: earner.teamRate, cost: 0, label: earner.label, level: earner.level };
  });
  return result;
}

// Build a rate card with FEE RATES for use in pricing calculations
function arrayToFeeRateCard(feeEarners: FeeEarner[]): RateCard {
  const result: RateCard = {} as RateCard;
  feeEarners.forEach(earner => {
    (result as any)[earner.key] = { rate: earner.feeRate, cost: 0, label: earner.label, level: earner.level };
  });
  return result;
}

interface EditableRateCardProps {
  rateCard: RateCard; // This stores TEAM RATES
  feeCurrency: string;
  teamRateCurrency: string;
  exchangeRate: number; // team currency to fee currency (e.g., 1.25 for GBP->USD)
  onSave: (teamRateCard: RateCard, feeRateCard: RateCard) => Promise<void>;
  onSaveAsDefault?: (rateCard: RateCard) => Promise<void>;
  onChange?: (teamRateCard: RateCard, feeRateCard: RateCard) => void;
  isSaving?: boolean;
  isSavingDefault?: boolean;
  afaDiscount?: number;
}

export function EditableRateCard({
  rateCard,
  feeCurrency,
  teamRateCurrency,
  exchangeRate,
  onSave,
  onSaveAsDefault,
  onChange,
  isSaving = false,
  isSavingDefault = false,
  afaDiscount = 0,
}: EditableRateCardProps) {
  const [feeEarners, setFeeEarners] = useState<FeeEarner[]>(() => 
    rateCardToArray(rateCard, exchangeRate)
  );
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEarnerLevel, setNewEarnerLevel] = useState<LevelValue>("associate");
  const [newEarnerLabel, setNewEarnerLabel] = useState("");
  const [newEarnerRate, setNewEarnerRate] = useState(0); // Rate entered in TEAM currency

  const feeCurrencySymbol = getCurrencySymbol(feeCurrency);
  const teamCurrencySymbol = getCurrencySymbol(teamRateCurrency);
  const showTwoColumns = teamRateCurrency !== feeCurrency;

  // Recalculate fee rates when exchange rate changes (for non-overridden rates)
  useEffect(() => {
    setFeeEarners(prev => prev.map(earner => {
      if (earner.feeRateOverridden) {
        // Keep manually set fee rate
        return earner;
      }
      // Recalculate from team rate
      return {
        ...earner,
        feeRate: Math.round(earner.teamRate * exchangeRate),
      };
    }));
  }, [exchangeRate]);
  // Notify parent of live changes for real-time preview (e.g., pyramid)
  useEffect(() => {
    onChange?.(arrayToRateCard(feeEarners), arrayToFeeRateCard(feeEarners));
  }, [feeEarners, onChange]);


  const sortedEarners = useMemo(() => 
    [...feeEarners].sort((a, b) => b.feeRate - a.feeRate),
    [feeEarners]
  );

  // Update team rate - ALWAYS clears override and recalculates fee rate
  const updateTeamRate = (key: string, newTeamRate: number) => {
    setFeeEarners(prev => prev.map(earner => {
      if (earner.key !== key) return earner;
      
      // Always clear override and recalculate fee rate from team rate
      return {
        ...earner,
        teamRate: newTeamRate,
        feeRate: Math.round(newTeamRate * exchangeRate),
        feeRateOverridden: false,
      };
    }));
  };

  // Update fee rate directly - marks as overridden
  const updateFeeRate = (key: string, newFeeRate: number) => {
    setFeeEarners(prev => prev.map(earner => 
      earner.key === key 
        ? { ...earner, feeRate: newFeeRate, feeRateOverridden: true } 
        : earner
    ));
  };

  // For single-currency mode, update both team and fee rate together
  const updateRate = (key: string, rate: number) => {
    setFeeEarners(prev => prev.map(earner => 
      earner.key === key 
        ? { ...earner, teamRate: rate, feeRate: rate, feeRateOverridden: false } 
        : earner
    ));
  };

  const updateFeeEarnerLabel = (key: string, label: string) => {
    setFeeEarners(prev => prev.map(earner => 
      earner.key === key ? { ...earner, label } : earner
    ));
  };

  const removeFeeEarner = (key: string) => {
    setFeeEarners(prev => prev.filter(earner => earner.key !== key));
  };

  const addFeeEarner = () => {
    if (!newEarnerLabel.trim()) return;
    
    const key = generateKey(newEarnerLevel, newEarnerLabel);
    const feeRate = Math.round(newEarnerRate * exchangeRate);

    setFeeEarners(prev => [...prev, {
      key,
      level: newEarnerLevel,
      label: newEarnerLabel.trim(),
      teamRate: newEarnerRate,
      feeRate: showTwoColumns ? feeRate : newEarnerRate,
      feeRateOverridden: false,
    }]);

    setNewEarnerLevel("associate");
    setNewEarnerLabel("");
    setNewEarnerRate(0);
    setIsAddDialogOpen(false);
  };

  const handleSave = async () => {
    const teamRateCard = arrayToRateCard(feeEarners);
    const feeRateCard = arrayToFeeRateCard(feeEarners);
    await onSave(teamRateCard, feeRateCard);
  };

  const getLevelBadge = (level: LevelValue) => {
    const levelInfo = LEVELS.find(l => l.value === level);
    return levelInfo?.label || level;
  };

  const afaDiscountMultiplier = 1 - (afaDiscount / 100);
  const hasAfaDiscount = afaDiscount > 0;

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(rate);
  };

  // Calculate column count based on what's shown
  const getGridCols = () => {
    if (showTwoColumns && hasAfaDiscount) {
      return 'grid-cols-[100px_1fr_auto_80px_auto_80px_auto_80px_28px]';
    } else if (showTwoColumns) {
      return 'grid-cols-[100px_1fr_auto_80px_auto_80px_28px]';
    } else if (hasAfaDiscount) {
      return 'grid-cols-[100px_1fr_auto_80px_auto_80px_28px]';
    }
    return 'grid-cols-[100px_1fr_auto_80px_28px]';
  };

  return (
    <>
      <Card className="max-w-2xl">
        <CardHeader className="pb-2 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Team & Rates
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {/* Header row */}
          {(showTwoColumns || hasAfaDiscount) && (
            <div className={`grid ${getGridCols()} items-center gap-2 py-1 border-b mb-1`}>
              <span className="text-xs font-medium text-muted-foreground">Level</span>
              <span className="text-xs font-medium text-muted-foreground">Label</span>
              <span></span>
              <span className="text-xs font-medium text-muted-foreground text-right">
                {showTwoColumns ? `Team Rate (${teamRateCurrency})` : 'Rate'}
              </span>
              {showTwoColumns && (
                <>
                  <span></span>
                  <span className="text-xs font-medium text-muted-foreground text-right">
                    Fee Rate ({feeCurrency})
                  </span>
                </>
              )}
              {hasAfaDiscount && (
                <>
                  <span></span>
                  <span className="text-xs font-medium text-destructive text-right">AFA Rate</span>
                </>
              )}
              <span></span>
            </div>
          )}
          <div className="space-y-1">
            {sortedEarners.map((earner) => (
              <div key={earner.key} className={`grid ${getGridCols()} items-center gap-2 py-1`}>
                <Select
                  value={earner.level}
                  onValueChange={(v) => setFeeEarners(prev => prev.map(e => e.key === earner.key ? { ...e, level: v as LevelValue } : e))}
                >
                  <SelectTrigger className="h-7 text-xs px-1.5 w-[100px] [&>span]:text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value} className="text-xs">
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={earner.label}
                  onChange={(e) => updateFeeEarnerLabel(earner.key, e.target.value)}
                  className="text-sm font-medium h-7 px-2"
                  placeholder="Label"
                />
                <span className="text-xs text-muted-foreground w-4 text-right">
                  {showTwoColumns ? teamCurrencySymbol : feeCurrencySymbol}
                </span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={showTwoColumns ? earner.teamRate : earner.feeRate}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (showTwoColumns) {
                      updateTeamRate(earner.key, val);
                    } else {
                      updateRate(earner.key, val);
                    }
                  }}
                  className={`h-7 text-right text-sm px-2 ${showTwoColumns && earner.feeRateOverridden ? 'bg-slate-200 border-slate-400 dark:bg-slate-700 dark:border-slate-500' : ''}`}
                />
                {showTwoColumns && (
                  <>
                    <span className="text-xs text-muted-foreground w-4 text-right">{feeCurrencySymbol}</span>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={earner.feeRate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        updateFeeRate(earner.key, val);
                      }}
                      className={`h-7 text-right text-sm px-2 ${earner.feeRateOverridden ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700' : ''}`}
                    />
                  </>
                )}
                {hasAfaDiscount && (
                  <>
                    <span className="text-xs text-muted-foreground w-4 text-right">{feeCurrencySymbol}</span>
                    <span className="text-sm font-medium text-destructive text-right bg-destructive/10 px-2 py-1 rounded h-7 flex items-center justify-end">
                      {formatRate(Math.round(earner.feeRate * afaDiscountMultiplier))}
                    </span>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFeeEarner(earner.key)}
                  className="h-7 w-7"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
            {sortedEarners.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">
                No team members. Click "Add" to build your team.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-3">
            {onSaveAsDefault && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs" 
                onClick={async () => {
                  // Save TEAM rates as default (not fee rates)
                  await onSaveAsDefault(arrayToRateCard(feeEarners));
                }}
                disabled={isSavingDefault}
              >
                {isSavingDefault ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save as default
              </Button>
            )}
            <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={newEarnerLevel} onValueChange={(v) => setNewEarnerLevel(v as LevelValue)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={newEarnerLabel}
                onChange={(e) => setNewEarnerLabel(e.target.value)}
                placeholder="e.g., Lead Partner, Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing Rate ({teamRateCurrency})</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{teamCurrencySymbol}</span>
                <Input
                  type="number"
                  step="1"
                  min={0}
                  value={newEarnerRate}
                  onChange={(e) => setNewEarnerRate(parseFloat(e.target.value) || 0)}
                />
              </div>
              {showTwoColumns && newEarnerRate > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {feeCurrencySymbol}{formatRate(Math.round(newEarnerRate * exchangeRate))} ({feeCurrency})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addFeeEarner} disabled={!newEarnerLabel.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
