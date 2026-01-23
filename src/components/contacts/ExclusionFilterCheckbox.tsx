import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DistributionContact } from "@/lib/hooks/useDistributionContacts";

interface ExclusionFilterCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  excludedContacts: DistributionContact[];
  onProtectContact: (contactId: string) => void;
  icon: React.ReactNode;
  className?: string;
}

export function ExclusionFilterCheckbox({
  label,
  checked,
  onCheckedChange,
  excludedContacts,
  onProtectContact,
  icon,
  className,
}: ExclusionFilterCheckboxProps) {
  const [showExcluded, setShowExcluded] = useState(false);
  const excludedCount = excludedContacts.length;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={label.replace(/\s+/g, '-').toLowerCase()}
          checked={checked}
          onCheckedChange={(checked) => onCheckedChange(checked === true)}
        />
        <label
          htmlFor={label.replace(/\s+/g, '-').toLowerCase()}
          className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
        >
          {icon}
          {label}
        </label>
      </div>

      {/* Show excluded contacts dropdown when filter is active and there are excluded contacts */}
      {checked && excludedCount > 0 && (
        <Popover open={showExcluded} onOpenChange={setShowExcluded}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {excludedCount}
              </Badge>
              excluded
              <ChevronDown className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 p-0" 
            align="start"
            sideOffset={4}
          >
            <div className="p-3 border-b">
              <h4 className="font-medium text-sm">Excluded Contacts</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Click ✕ to protect a contact from this filter
              </p>
            </div>
            <ScrollArea className="h-64 overflow-auto">
              <div className="p-2 space-y-1">
                {excludedContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contact.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Building2 className="h-3 w-3 flex-shrink-0" />
                        {contact.company || "No company"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProtectContact(contact.id);
                      }}
                      title="Protect from this filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
