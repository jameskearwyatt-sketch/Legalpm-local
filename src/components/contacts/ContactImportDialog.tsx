import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkCreateDistributionContacts } from "@/lib/hooks/useDistributionContacts";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [pastedText, setPastedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const bulkCreate = useBulkCreateDistributionContacts();
  const logActivity = useLogDistributionActivity();

  const handleImport = async () => {
    if (!pastedText.trim()) {
      toast.error("Please paste some contact data");
      return;
    }

    setIsProcessing(true);
    try {
      // Simple CSV/text parsing - parse lines as name, email pairs
      const lines = pastedText.trim().split("\n").filter(l => l.trim());
      const contacts = lines.map(line => {
        const parts = line.split(/[,\t]/).map(p => p.trim());
        const emailPart = parts.find(p => p.includes("@")) || "";
        const namePart = parts.find(p => !p.includes("@") && p.length > 0) || "Unknown";
        
        return {
          full_name: namePart,
          email: emailPart,
          company: null,
          job_title: null,
          country: null,
          city: null,
          gender: "unknown" as const,
          sectors: [],
          sectors_ai_assigned: false,
          linkedin_url: null,
          notes: null,
          relationship_owner: null,
          do_not_contact: false,
          provenance: "Pasted import",
        };
      }).filter(c => c.email);

      if (contacts.length === 0) {
        toast.error("No valid contacts found. Ensure each line has an email address.");
        return;
      }

      await bulkCreate.mutateAsync(contacts);
      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from pasted text`,
        metadata: { count: contacts.length },
      });

      setPastedText("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Import failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList>
            <TabsTrigger value="paste" className="gap-2">
              <FileText className="h-4 w-4" />
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2" disabled>
              <Upload className="h-4 w-4" />
              Upload File (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-4">
            <div>
              <Label>Paste contact data</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Paste names and emails, one per line. Supports CSV format.
              </p>
              <Textarea
                rows={10}
                placeholder="John Smith, john@example.com&#10;Jane Doe, jane@example.com"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isProcessing || !pastedText.trim()}>
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
