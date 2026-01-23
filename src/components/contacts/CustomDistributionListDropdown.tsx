import { useState } from "react";
import { Plus, List, ChevronDown, Trash2, Edit2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCustomDistributionLists, type CustomDistributionList } from "@/lib/hooks/useCustomDistributionLists";
import { cn } from "@/lib/utils";

interface CustomDistributionListDropdownProps {
  selectedListId: string | null;
  onSelectList: (listId: string | null) => void;
}

export function CustomDistributionListDropdown({
  selectedListId,
  onSelectList,
}: CustomDistributionListDropdownProps) {
  const { lists, createList, deleteList, updateList } = useCustomDistributionLists();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<CustomDistributionList | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const selectedList = lists.find(l => l.id === selectedListId);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    await createList.mutateAsync({
      name: newListName.trim(),
      description: newListDescription.trim() || undefined,
    });
    
    setNewListName("");
    setNewListDescription("");
    setIsCreateDialogOpen(false);
  };

  const handleEditList = async () => {
    if (!editingList || !newListName.trim()) return;
    
    await updateList.mutateAsync({
      id: editingList.id,
      name: newListName.trim(),
      description: newListDescription.trim() || undefined,
    });
    
    setNewListName("");
    setNewListDescription("");
    setEditingList(null);
    setIsEditDialogOpen(false);
  };

  const handleDeleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this distribution list? All contacts will be removed from the list.")) {
      await deleteList.mutateAsync(listId);
      if (selectedListId === listId) {
        onSelectList(null);
      }
    }
  };

  const openEditDialog = (list: CustomDistributionList, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingList(list);
    setNewListName(list.name);
    setNewListDescription(list.description || "");
    setIsEditDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={selectedListId ? "default" : "outline"} 
            className={cn(
              "gap-2",
              selectedListId && "bg-violet-600 hover:bg-violet-700"
            )}
          >
            <List className="h-4 w-4" />
            {selectedList ? (
              <>
                {selectedList.name}
                <Badge variant="secondary" className="ml-1 bg-white/20 text-white">
                  {selectedList.contact_count}
                </Badge>
              </>
            ) : (
              "Custom Lists"
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem
            onClick={() => setIsCreateDialogOpen(true)}
            className="gap-2 text-emerald-600 dark:text-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Create New List
          </DropdownMenuItem>
          
          {lists.length > 0 && <DropdownMenuSeparator />}
          
          {selectedListId && (
            <>
              <DropdownMenuItem
                onClick={() => onSelectList(null)}
                className="gap-2 text-muted-foreground"
              >
                <Users className="h-4 w-4" />
                Show All Contacts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {lists.map((list) => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => onSelectList(list.id)}
              className={cn(
                "gap-2 justify-between group",
                selectedListId === list.id && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <List className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="truncate">{list.name}</span>
                <Badge variant="secondary" className="shrink-0">
                  {list.contact_count}
                </Badge>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => openEditDialog(list, e)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => handleDeleteList(list.id, e)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))}
          
          {lists.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No custom lists yet. Create one to get started!
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create List Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Distribution List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">List Name *</label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Nuclear Energy Contacts"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Add a description for this list..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateList}
              disabled={!newListName.trim() || createList.isPending}
            >
              {createList.isPending ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Distribution List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">List Name *</label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Nuclear Energy Contacts"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Add a description for this list..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditList}
              disabled={!newListName.trim() || updateList.isPending}
            >
              {updateList.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
