import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useBulkCreateDistributionContacts,
  type DistributionContactInsert
} from "@/lib/hooks/useDistributionContacts";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { Loader2, Check, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayName } from "@/lib/utils";

interface ImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: DistributionContactInsert[];
  source: string;
  onComplete: (importedIds: string[]) => void;
}

export function ImportPreviewDialog({
  open,
  onOpenChange,
  contacts,
  source,
  onComplete,
}: ImportPreviewDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const bulkCreate = useBulkCreateDistributionContacts();
  const logActivity = useLogDistributionActivity();

  const handleImport = async () => {
    setIsProcessing(true);

    try {
      // Create all contacts
      const result = await bulkCreate.mutateAsync(contacts);

      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from ${source}`,
        metadata: { count: contacts.length, source },
      });

      toast.success(`Imported ${contacts.length} contacts`);

      // Pass back the IDs of imported contacts for filtering
      const importedIds = result?.map((c: { id: string }) => c.id) || [];
      onComplete(importedIds);
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isProcessing && onOpenChange(o)}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Review Contacts Before Import
          </DialogTitle>
          <DialogDescription>
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} will be added to your database
          </DialogDescription>
        </DialogHeader>

        {!isProcessing ? (
          <>
            <div className="flex-1 max-h-[400px] border rounded-md overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[220px]">Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px]">Country</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{formatDisplayName(contact.full_name)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.email}
                      </TableCell>
                      <TableCell className="text-sm">{contact.company || "—"}</TableCell>
                      <TableCell className="text-sm">{contact.job_title || "—"}</TableCell>
                      <TableCell className="text-sm">{contact.country || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />
          </>
        ) : (
          <div className="py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Saving contacts...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Adding {contacts.length} contacts to your database
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isProcessing || contacts.length === 0}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
