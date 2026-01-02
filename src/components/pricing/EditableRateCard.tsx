import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, Loader2, Users } from "lucide-react";
import { RateCard } from "@/lib/hooks/usePricingProposals";

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
  rate: number;
}

// Default labels with numbered suffix
const DEFAULT_LABELS: Record<string, string> = {
  partner: "Partner 1",
  counsel: "Counsel 1",
  seniorAssociate: "Senior Associate 1",
  associate: "Associate 1",
  trainee: "Trainee 1",
};

// Level order for sorting (after rate)
const LEVEL_ORDER: Record<LevelValue, number> = {
  partner: 0,
  counsel: 1,
  seniorAssociate: 2,
  associate: 3,
  trainee: 4,
};

// Convert RateCard to array format for dynamic editing
function rateCardToArray(rateCard: RateCard): FeeEarner[] {
  return Object.entries(rateCard).map(([key, value]) => {
    // Try to determine level from key
    let level: LevelValue = "associate";
    if (key.includes("partner") || key.startsWith("partner")) level = "partner";
    else if (key.includes("counsel") || key.startsWith("counsel")) level = "counsel";
    else if (key.includes("seniorAssociate") || key.startsWith("seniorAssociate")) level = "seniorAssociate";
    else if (key.includes("trainee") || key.startsWith("trainee")) level = "trainee";
    else if (key.includes("associate") || key.startsWith("associate")) level = "associate";
    
    return {
      key,
      level,
      label: DEFAULT_LABELS[key] || formatLabel(key),
      rate: value.rate,
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
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `${level}_${baseKey}_${Date.now()}`;
}

// Convert array back to RateCard format (with required defaults)
function arrayToRateCard(feeEarners: FeeEarner[]): RateCard {
  const result: RateCard = {
    partner: { rate: 0, cost: 0 },
    seniorAssociate: { rate: 0, cost: 0 },
    associate: { rate: 0, cost: 0 },
    trainee: { rate: 0, cost: 0 },
  };
  feeEarners.forEach(earner => {
    if (earner.key in result) {
      (result as any)[earner.key] = { rate: earner.rate, cost: 0 };
    } else {
      (result as any)[earner.key] = { rate: earner.rate, cost: 0 };
    }
  });
  return result;
}

interface EditableRateCardProps {
  rateCard: RateCard;
  currencySymbol: string;
  onSave: (rateCard: RateCard) => Promise<void>;
  isSaving?: boolean;
}

export function EditableRateCard({
  rateCard,
  currencySymbol,
  onSave,
  isSaving = false,
}: EditableRateCardProps) {
  const [feeEarners, setFeeEarners] = useState<FeeEarner[]>(() => rateCardToArray(rateCard));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newEarnerLevel, setNewEarnerLevel] = useState<LevelValue>("associate");
  const [newEarnerLabel, setNewEarnerLabel] = useState("");
  const [newEarnerRate, setNewEarnerRate] = useState(0);

  // Sort by rate descending
  const sortedEarners = useMemo(() => 
    [...feeEarners].sort((a, b) => b.rate - a.rate),
    [feeEarners]
  );

  const updateFeeEarner = (key: string, value: number) => {
    setFeeEarners(prev => prev.map(earner => 
      earner.key === key ? { ...earner, rate: value } : earner
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

    setFeeEarners(prev => [...prev, {
      key,
      level: newEarnerLevel,
      label: newEarnerLabel.trim(),
      rate: newEarnerRate,
    }]);

    setNewEarnerLevel("associate");
    setNewEarnerLabel("");
    setNewEarnerRate(0);
    setIsAddDialogOpen(false);
  };

  const handleSave = async () => {
    await onSave(arrayToRateCard(feeEarners));
  };

  const getLevelBadge = (level: LevelValue) => {
    const levelInfo = LEVELS.find(l => l.value === level);
    return levelInfo?.label || level;
  };

  return (
    <>
      <Card className="max-w-md">
        <CardHeader className="pb-2 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Team Rate Card
            </CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-1">
            {sortedEarners.map((earner) => (
              <div key={earner.key} className="grid grid-cols-[100px_1fr_auto_80px_28px] items-center gap-2 py-1">
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-center truncate">
                  {getLevelBadge(earner.level)}
                </span>
                <Input
                  value={earner.label}
                  onChange={(e) => updateFeeEarnerLabel(earner.key, e.target.value)}
                  className="text-sm font-medium h-7 px-2"
                  placeholder="Label"
                />
                <span className="text-xs text-muted-foreground w-4 text-right">{currencySymbol}</span>
                <Input
                  type="number"
                  value={earner.rate}
                  onChange={(e) => updateFeeEarner(earner.key, parseFloat(e.target.value) || 0)}
                  className="h-7 text-right text-sm px-2"
                />
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

          <div className="flex justify-end pt-3 border-t mt-3">
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
              <Label>Billing Rate</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                <Input
                  type="number"
                  value={newEarnerRate}
                  onChange={(e) => setNewEarnerRate(parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </div>
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
