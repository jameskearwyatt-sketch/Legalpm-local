import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, ListPlus } from "lucide-react";
import {
  useBMContactShortlists,
  useCreateBMShortlist,
  useAddToShortlist,
} from "@/lib/hooks/useBMContactShortlists";

interface BMAddToShortlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  onSuccess?: () => void;
}

export function BMAddToShortlistDialog({
  open,
  onOpenChange,
  contactIds,
  onSuccess,
}: BMAddToShortlistDialogProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedShortlistId, setSelectedShortlistId] = useState<string>('');
  const [newShortlistName, setNewShortlistName] = useState('');

  const { data: shortlists = [] } = useBMContactShortlists();
  const createShortlist = useCreateBMShortlist();
  const addToShortlist = useAddToShortlist();

  const isLoading = createShortlist.isPending || addToShortlist.isPending;

  const handleSubmit = async () => {
    if (contactIds.length === 0) return;

    try {
      let shortlistId = selectedShortlistId;

      if (mode === 'new') {
        if (!newShortlistName.trim()) return;
        const newShortlist = await createShortlist.mutateAsync({
          name: newShortlistName.trim(),
        });
        shortlistId = newShortlist.id;
      }

      if (!shortlistId) return;

      await addToShortlist.mutateAsync({
        shortlistId,
        contactIds,
      });

      onOpenChange(false);
      onSuccess?.();
      
      // Reset state
      setMode('existing');
      setSelectedShortlistId('');
      setNewShortlistName('');
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const canSubmit = mode === 'new' 
    ? newShortlistName.trim().length > 0 
    : selectedShortlistId.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Shortlist</DialogTitle>
          <DialogDescription>
            Add {contactIds.length} contact{contactIds.length !== 1 ? 's' : ''} to a shortlist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {shortlists.length > 0 ? (
            <>
              <div className="flex gap-4">
                <Button
                  variant={mode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('existing')}
                  className="flex-1"
                >
                  <ListPlus className="h-4 w-4 mr-2" />
                  Existing
                </Button>
                <Button
                  variant={mode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('new')}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-2">
                  <Label>Select a shortlist</Label>
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <RadioGroup
                      value={selectedShortlistId}
                      onValueChange={setSelectedShortlistId}
                    >
                      {shortlists.map((shortlist) => (
                        <div
                          key={shortlist.id}
                          className="flex items-center space-x-2 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => setSelectedShortlistId(shortlist.id)}
                        >
                          <RadioGroupItem value={shortlist.id} id={shortlist.id} />
                          <Label htmlFor={shortlist.id} className="cursor-pointer flex-1">
                            {shortlist.name}
                            {shortlist.description && (
                              <span className="text-muted-foreground text-sm block">
                                {shortlist.description}
                              </span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </ScrollArea>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="name">Shortlist name</Label>
                  <Input
                    id="name"
                    value={newShortlistName}
                    onChange={(e) => setNewShortlistName(e.target.value)}
                    placeholder="e.g., US Nuclear BD Team"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                You don't have any shortlists yet. Create your first one:
              </p>
              <Label htmlFor="name">Shortlist name</Label>
              <Input
                id="name"
                value={newShortlistName}
                onChange={(e) => setNewShortlistName(e.target.value)}
                placeholder="e.g., US Nuclear BD Team"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Shortlist'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
