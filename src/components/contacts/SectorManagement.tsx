import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useDistributionSectors,
  useCreateDistributionSector,
  useDeleteDistributionSector,
} from "@/lib/hooks/useDistributionSectors";
import { Plus, Trash2, Tags } from "lucide-react";

export function SectorManagement() {
  const [newSector, setNewSector] = useState("");
  const [sectorToDelete, setSectorToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: sectors = [], isLoading } = useDistributionSectors();
  const createSector = useCreateDistributionSector();
  const deleteSector = useDeleteDistributionSector();

  const handleAddSector = async () => {
    if (!newSector.trim()) return;
    await createSector.mutateAsync(newSector.trim());
    setNewSector("");
  };

  const handleDeleteSector = async () => {
    if (!sectorToDelete) return;
    await deleteSector.mutateAsync(sectorToDelete.id);
    setSectorToDelete(null);
  };

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Sector Taxonomy
          </CardTitle>
          <CardDescription>
            Manage the closed list of sectors that can be assigned to contacts.
            AI will only assign sectors from this list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New sector name..."
              value={newSector}
              onChange={(e) => setNewSector(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
            />
            <Button 
              onClick={handleAddSector} 
              disabled={!newSector.trim() || createSector.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading sectors...</p>
          ) : sectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tags className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No sectors defined yet.</p>
              <p className="text-sm">Add sectors to categorise your contacts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sectors.map((sector) => (
                <div
                  key={sector.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                >
                  <span className="font-medium">{sector.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setSectorToDelete({ id: sector.id, name: sector.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">AI Sector Mapping</h4>
            <p className="text-sm text-muted-foreground">
              When importing contacts, AI will intelligently map related concepts to your defined sectors:
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>LNG, upstream, downstream → Oil & Gas</li>
              <li>SMRs, fusion → Nuclear</li>
              <li>CCS, carbon capture → CCUS</li>
              <li>Solar, wind, hydro → Renewables</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!sectorToDelete} onOpenChange={() => setSectorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sector</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sectorToDelete?.name}"? 
              This will not remove the sector from existing contacts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSector}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
