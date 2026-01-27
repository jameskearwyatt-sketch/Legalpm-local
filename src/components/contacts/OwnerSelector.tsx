import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { User, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OwnerSelectorProps {
  defaultOwner: string;
  onOwnerChange: (owner: string) => void;
  relationshipOwners: { id: string; name: string }[];
}

export function OwnerSelector({ defaultOwner, onOwnerChange, relationshipOwners }: OwnerSelectorProps) {
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOwners = ownerSearch.trim() 
    ? relationshipOwners.filter(o =>
        o.name.toLowerCase().includes(ownerSearch.toLowerCase())
      )
    : relationshipOwners;

  const showAddNew = ownerSearch.trim() && 
    !filteredOwners.some(o => o.name.toLowerCase() === ownerSearch.trim().toLowerCase());

  // Focus input when popover opens
  useEffect(() => {
    if (ownerPopoverOpen && inputRef.current) {
      // Small delay to ensure popover is rendered
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [ownerPopoverOpen]);

  const handleSelect = (name: string) => {
    onOwnerChange(name);
    setOwnerSearch("");
    setOwnerPopoverOpen(false);
  };

  return (
    <div>
      <Label className="flex items-center gap-2">
        <User className="h-4 w-4" />
        Contact Owner <span className="text-destructive">*</span>
      </Label>
      <p className="text-sm text-muted-foreground mb-2">
        Required. Assign a relationship owner to imported contacts.
      </p>
      <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-between",
              !defaultOwner && "border-destructive/50"
            )}
          >
            {defaultOwner || "Select or type owner name..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0 bg-popover" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center border-b px-3">
            <User className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search or add owner..."
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ownerSearch.trim()) {
                  e.preventDefault();
                  handleSelect(ownerSearch.trim());
                }
              }}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {showAddNew && (
              <button
                type="button"
                className="w-full p-2 text-left hover:bg-accent text-sm flex items-center gap-2"
                onClick={() => handleSelect(ownerSearch.trim())}
              >
                <span className="text-primary">+</span> Add "{ownerSearch.trim()}" as new owner
              </button>
            )}
            {filteredOwners.length === 0 && !showAddNew && (
              <p className="p-2 text-sm text-muted-foreground">No owners found. Type to add one.</p>
            )}
            {filteredOwners.map((owner) => (
              <button
                key={owner.id}
                type="button"
                className={cn(
                  "w-full p-2 text-left hover:bg-accent text-sm flex items-center gap-2",
                  defaultOwner === owner.name && "bg-accent"
                )}
                onClick={() => handleSelect(owner.name)}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    defaultOwner === owner.name ? "opacity-100" : "opacity-0"
                  )}
                />
                {owner.name}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {!defaultOwner && (
        <p className="text-sm text-destructive mt-1">Please select or enter an owner</p>
      )}
    </div>
  );
}
