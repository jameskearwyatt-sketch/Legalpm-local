import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Loader2, Users } from "lucide-react";
import { RateCard } from "@/lib/hooks/usePricingProposals";

interface FeeEarner {
  key: string;
  label: string;
  rate: number;
}

// Convert RateCard to array format for dynamic editing
function rateCardToArray(rateCard: RateCard): FeeEarner[] {
  return Object.entries(rateCard).map(([key, value]) => ({
    key,
    label: formatLabel(key),
    rate: value.rate,
  }));
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function generateKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
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
  const [newEarnerLabel, setNewEarnerLabel] = useState("");
  const [newEarnerRate, setNewEarnerRate] = useState(0);

  const updateFeeEarner = (key: string, value: number) => {
    setFeeEarners(prev => prev.map(earner => 
      earner.key === key ? { ...earner, rate: value } : earner
    ));
  };

  const removeFeeEarner = (key: string) => {
    setFeeEarners(prev => prev.filter(earner => earner.key !== key));
  };

  const addFeeEarner = () => {
    if (!newEarnerLabel.trim()) return;
    
    const key = generateKey(newEarnerLabel);
    if (feeEarners.some(e => e.key === key)) {
      return; // Already exists
    }

    setFeeEarners(prev => [...prev, {
      key,
      label: newEarnerLabel.trim(),
      rate: newEarnerRate,
    }]);

    setNewEarnerLabel("");
    setNewEarnerRate(0);
    setIsAddDialogOpen(false);
  };

  const handleSave = async () => {
    await onSave(arrayToRateCard(feeEarners));
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Team Rate Card
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2">Fee Earner</TableHead>
                <TableHead className="text-right py-2 w-[100px]">Rate ({currencySymbol})</TableHead>
                <TableHead className="w-[40px] py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeEarners.map((earner) => (
                <TableRow key={earner.key}>
                  <TableCell className="font-medium py-1.5">{earner.label}</TableCell>
                  <TableCell className="py-1.5">
                    <Input
                      type="number"
                      value={earner.rate}
                      onChange={(e) => updateFeeEarner(earner.key, parseFloat(e.target.value) || 0)}
                      className="w-24 h-8 text-right ml-auto text-sm"
                    />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeeEarner(earner.key)}
                      className="h-7 w-7"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {feeEarners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6 text-sm">
                    No team members. Click "Add" to build your team.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role / Title</Label>
              <Input
                value={newEarnerLabel}
                onChange={(e) => setNewEarnerLabel(e.target.value)}
                placeholder="e.g., Counsel, Paralegal"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing Rate ({currencySymbol})</Label>
              <Input
                type="number"
                value={newEarnerRate}
                onChange={(e) => setNewEarnerRate(parseFloat(e.target.value) || 0)}
                min={0}
              />
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
