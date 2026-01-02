import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Loader2, Users } from "lucide-react";
import { RateCard } from "@/lib/hooks/usePricingProposals";

interface FeeOwner {
  key: string;
  label: string;
  rate: number;
}

// Convert RateCard to array format for dynamic editing
function rateCardToArray(rateCard: RateCard): FeeOwner[] {
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
function arrayToRateCard(feeOwners: FeeOwner[]): RateCard {
  const result: RateCard = {
    partner: { rate: 0, cost: 0 },
    seniorAssociate: { rate: 0, cost: 0 },
    associate: { rate: 0, cost: 0 },
    trainee: { rate: 0, cost: 0 },
  };
  feeOwners.forEach(owner => {
    if (owner.key in result) {
      (result as any)[owner.key] = { rate: owner.rate, cost: 0 };
    } else {
      // For custom fee owners, we store them with their key
      (result as any)[owner.key] = { rate: owner.rate, cost: 0 };
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
  const [feeOwners, setFeeOwners] = useState<FeeOwner[]>(() => rateCardToArray(rateCard));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newOwnerLabel, setNewOwnerLabel] = useState("");
  const [newOwnerRate, setNewOwnerRate] = useState(0);

  const updateFeeOwner = (key: string, value: number) => {
    setFeeOwners(prev => prev.map(owner => 
      owner.key === key ? { ...owner, rate: value } : owner
    ));
  };

  const removeFeeOwner = (key: string) => {
    setFeeOwners(prev => prev.filter(owner => owner.key !== key));
  };

  const addFeeOwner = () => {
    if (!newOwnerLabel.trim()) return;
    
    const key = generateKey(newOwnerLabel);
    if (feeOwners.some(o => o.key === key)) {
      return; // Already exists
    }

    setFeeOwners(prev => [...prev, {
      key,
      label: newOwnerLabel.trim(),
      rate: newOwnerRate,
    }]);

    setNewOwnerLabel("");
    setNewOwnerRate(0);
    setIsAddDialogOpen(false);
  };

  const handleSave = async () => {
    await onSave(arrayToRateCard(feeOwners));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Rate Card
              </CardTitle>
              <CardDescription>
                Build your team by adding fee owners with their billing and cost rates
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Owner</TableHead>
                <TableHead className="text-right">Billing Rate ({currencySymbol})</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeOwners.map((owner) => (
                <TableRow key={owner.key}>
                  <TableCell className="font-medium">{owner.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={owner.rate}
                      onChange={(e) => updateFeeOwner(owner.key, parseFloat(e.target.value) || 0)}
                      className="w-28 text-right ml-auto"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeeOwner(owner.key)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {feeOwners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No team members added. Click "Add Team Member" to build your team.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Rate Card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Team Member Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role / Title</Label>
              <Input
                value={newOwnerLabel}
                onChange={(e) => setNewOwnerLabel(e.target.value)}
                placeholder="e.g., Counsel, Junior Associate, Paralegal"
              />
            </div>
            <div className="space-y-2">
              <Label>Billing Rate ({currencySymbol})</Label>
              <Input
                type="number"
                value={newOwnerRate}
                onChange={(e) => setNewOwnerRate(parseFloat(e.target.value) || 0)}
                min={0}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addFeeOwner} disabled={!newOwnerLabel.trim()}>
              Add Team Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
