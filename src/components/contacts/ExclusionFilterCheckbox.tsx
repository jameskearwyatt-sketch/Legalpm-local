import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type DistributionContact } from "@/lib/hooks/useDistributionContacts";

interface ExclusionFilterCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  excludedContacts: DistributionContact[];
  onProtectContact: (contactId: string) => void;
  onBulkProtectContacts?: (contactIds: string[]) => Promise<void>;
  icon: React.ReactNode;
  className?: string;
}

export function ExclusionFilterCheckbox({
  label,
  checked,
  onCheckedChange,
  excludedContacts,
  onProtectContact,
  onBulkProtectContacts,
  icon,
  className,
}: ExclusionFilterCheckboxProps) {
  const [showExcluded, setShowExcluded] = useState(false);
  const [selectedForProtection, setSelectedForProtection] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  
  const excludedCount = excludedContacts.length;
  const selectedCount = selectedForProtection.size;

  // Reset selection when popover closes or excluded contacts change
  useEffect(() => {
    if (!showExcluded) {
      setSelectedForProtection(new Set());
    }
  }, [showExcluded]);

  // Also reset when the excluded contacts list changes (after processing)
  useEffect(() => {
    setSelectedForProtection(prev => {
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (excludedContacts.some(c => c.id === id)) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [excludedContacts]);

  const handleSelectAll = () => {
    setSelectedForProtection(new Set(excludedContacts.map(c => c.id)));
  };

  const handleSelectNone = () => {
    setSelectedForProtection(new Set());
  };

  const handleToggleContact = (contactId: string) => {
    setSelectedForProtection(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleProcess = async () => {
    if (selectedCount === 0) return;
    
    setIsProcessing(true);
    try {
      if (onBulkProtectContacts) {
        // Use bulk operation if available
        await onBulkProtectContacts(Array.from(selectedForProtection));
      } else {
        // Fall back to individual calls
        const ids = Array.from(selectedForProtection);
        for (const id of ids) {
          onProtectContact(id);
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      setSelectedForProtection(new Set());
      setShowExcluded(false);
    } catch (error) {
      console.error('Failed to process contacts:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isAllSelected = excludedCount > 0 && selectedCount === excludedCount;
  const isNoneSelected = selectedCount === 0;

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
            className="w-96 p-0" 
            align="start"
            sideOffset={4}
          >
            {/* Header */}
            <div className="p-3 border-b bg-muted/30">
              <h4 className="font-medium text-sm">Excluded Contacts</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Select contacts to protect from this filter, then click Process
              </p>
            </div>
            
            {/* Selection controls */}
            <div className="p-2 border-b flex items-center justify-between gap-2 bg-muted/10">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectAll}
                  disabled={isAllSelected || isProcessing}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSelectNone}
                  disabled={isNoneSelected || isProcessing}
                >
                  Select None
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedCount} of {excludedCount} selected
              </span>
            </div>

            {/* Contacts list with checkboxes */}
            <ScrollArea className="h-64 overflow-auto">
              <div className="p-2 space-y-1">
                {excludedContacts.map((contact) => {
                  const isSelected = selectedForProtection.has(contact.id);
                  return (
                    <label
                      key={contact.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                        isSelected 
                          ? "bg-primary/10 border border-primary/20" 
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleContact(contact.id)}
                        disabled={isProcessing}
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Building2 className="h-3 w-3 flex-shrink-0" />
                          {contact.company || "No company"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer with Process button */}
            <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Protected contacts won't be excluded
              </p>
              <Button
                size="sm"
                onClick={handleProcess}
                disabled={selectedCount === 0 || isProcessing}
                className="gap-2"
              >
                {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                Process {selectedCount > 0 && `(${selectedCount})`}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
