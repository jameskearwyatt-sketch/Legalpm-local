import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { type DistributionContact } from "@/lib/hooks/useDistributionContacts";
import { Loader2, RotateCcw, Building2, Users } from "lucide-react";
import { cn, formatDisplayName } from "@/lib/utils";

interface ReidentifyExcludedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protectedContacts: DistributionContact[];
  onReidentify: (contactIds: string[]) => Promise<void>;
}

export function ReidentifyExcludedDialog({
  open,
  onOpenChange,
  protectedContacts,
  onReidentify,
}: ReidentifyExcludedDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedIds.size;
  const totalCount = protectedContacts.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isNoneSelected = selectedCount === 0;

  // Reset selection when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

  // Keep selection in sync with available contacts
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set<string>();
      prev.forEach(id => {
        if (protectedContacts.some(c => c.id === id)) {
          validIds.add(id);
        }
      });
      return validIds;
    });
  }, [protectedContacts]);

  const handleSelectAll = () => {
    setSelectedIds(new Set(protectedContacts.map(c => c.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleToggle = (contactId: string) => {
    setSelectedIds(prev => {
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
      await onReidentify(Array.from(selectedIds));
      setSelectedIds(new Set());
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to re-identify contacts:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getProtectionType = (contact: DistributionContact): "law_firm" | "consultant" | "both" => {
    const reason = contact.classification_reason || "";
    const isLawFirmProtected = reason.includes("law firm exclusion");
    const isConsultantProtected = reason.includes("consultant exclusion");
    
    if (isLawFirmProtected && isConsultantProtected) return "both";
    if (isLawFirmProtected) return "law_firm";
    return "consultant";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Re-identify Excluded Contacts
          </DialogTitle>
          <DialogDescription>
            These contacts were protected from exclusion filters. Select which ones to re-identify 
            so they appear in the "Exclude law firms" or "Exclude consultants" lists again.
          </DialogDescription>
        </DialogHeader>
        
        {/* Selection controls */}
        <div className="flex items-center justify-between gap-2 py-2 border-b">
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
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Contacts list */}
        <ScrollArea className="h-80 -mx-2 px-2">
          <div className="space-y-1">
            {protectedContacts.map((contact) => {
              const isSelected = selectedIds.has(contact.id);
              const protectionType = getProtectionType(contact);
              
              return (
                <label
                  key={contact.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                    isSelected 
                      ? "bg-accent border border-primary/30" 
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(contact.id)}
                    disabled={isProcessing}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{formatDisplayName(contact.full_name)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.company || contact.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(protectionType === "law_firm" || protectionType === "both") && (
                      <Badge variant="outline" className="text-xs gap-1 py-0">
                        <Building2 className="h-3 w-3" />
                        Law Firm
                      </Badge>
                    )}
                    {(protectionType === "consultant" || protectionType === "both") && (
                      <Badge variant="outline" className="text-xs gap-1 py-0">
                        <Users className="h-3 w-3" />
                        Consultant
                      </Badge>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={selectedCount === 0 || isProcessing}
            className="gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Re-identify {selectedCount > 0 ? `(${selectedCount})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
