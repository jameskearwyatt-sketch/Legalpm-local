import { useState, useEffect } from "react";
import { List, Check, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomDistributionLists, useCustomListContacts } from "@/lib/hooks/useCustomDistributionLists";
import { toast } from "sonner";

interface Contact {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
}

interface AddToListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContacts: Contact[];
  onSuccess?: () => void;
}

export function AddToListDialog({
  open,
  onOpenChange,
  selectedContacts,
  onSuccess,
}: AddToListDialogProps) {
  const { lists } = useCustomDistributionLists();
  const { checkExistingContacts, addContacts } = useCustomListContacts(null);
  
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [existingContacts, setExistingContacts] = useState<Contact[]>([]);
  const [contactsToAdd, setContactsToAdd] = useState<Contact[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedListId("");
      setExistingContacts([]);
      setContactsToAdd([]);
      setHasChecked(false);
    }
  }, [open]);

  // Check for existing contacts when list is selected
  useEffect(() => {
    const checkContacts = async () => {
      if (!selectedListId || selectedContacts.length === 0) {
        setExistingContacts([]);
        setContactsToAdd([]);
        setHasChecked(false);
        return;
      }

      setIsChecking(true);
      try {
        const contactIds = selectedContacts.map(c => c.id);
        const result = await checkExistingContacts(selectedListId, contactIds);
        
        const existingSet = new Set(result.existing);
        const toAddSet = new Set(result.toAdd);
        
        setExistingContacts(selectedContacts.filter(c => existingSet.has(c.id)));
        setContactsToAdd(selectedContacts.filter(c => toAddSet.has(c.id)));
        setHasChecked(true);
      } catch (error) {
        console.error("Error checking contacts:", error);
        toast.error("Failed to check existing contacts");
      } finally {
        setIsChecking(false);
      }
    };

    checkContacts();
  }, [selectedListId, selectedContacts, checkExistingContacts]);

  const handleAddContacts = async () => {
    if (!selectedListId || contactsToAdd.length === 0) return;

    setIsAdding(true);
    try {
      await addContacts.mutateAsync({
        listId: selectedListId,
        contactIds: contactsToAdd.map(c => c.id),
      });
      
      toast.success(`Added ${contactsToAdd.length} contact(s) to list`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error adding contacts:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const selectedList = lists.find(l => l.id === selectedListId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-violet-500" />
            Add to Distribution List
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select List</label>
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a distribution list..." />
              </SelectTrigger>
              <SelectContent>
                {lists.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No lists available. Create one first.
                  </div>
                ) : (
                  lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      <div className="flex items-center gap-2">
                        <span>{list.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {list.contact_count}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {isChecking && (
            <div className="text-center py-4 text-muted-foreground">
              Checking existing contacts...
            </div>
          )}

          {hasChecked && selectedListId && !isChecking && (
            <div className="space-y-4">
              {/* Contacts already in list */}
              {existingContacts.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Already in "{selectedList?.name}" ({existingContacts.length})
                    </span>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {existingContacts.map((contact) => (
                        <div key={contact.id} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <Check className="h-3 w-3" />
                          <span className="font-medium">{contact.full_name}</span>
                          <span className="text-amber-600/70 dark:text-amber-500">
                            {contact.company || contact.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Contacts to be added */}
              {contactsToAdd.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Will be added ({contactsToAdd.length})
                    </span>
                  </div>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {contactsToAdd.map((contact) => (
                        <div key={contact.id} className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          <span className="font-medium">{contact.full_name}</span>
                          <span className="text-emerald-600/70 dark:text-emerald-500">
                            {contact.company || contact.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* All contacts already exist */}
              {contactsToAdd.length === 0 && existingContacts.length > 0 && (
                <div className="text-center py-2 text-muted-foreground text-sm">
                  All selected contacts are already in this list.
                </div>
              )}
            </div>
          )}

          {!selectedListId && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Select a list to see which contacts will be added.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddContacts}
            disabled={!selectedListId || contactsToAdd.length === 0 || isAdding || isChecking}
            className="gap-2"
          >
            {isAdding ? (
              "Adding..."
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Add {contactsToAdd.length} Contact{contactsToAdd.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
