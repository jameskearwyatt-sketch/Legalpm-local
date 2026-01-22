import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  type DistributionContact,
  useDeleteDistributionContact,
} from "@/lib/hooks/useDistributionContacts";
import { ContactFormDialog } from "./ContactFormDialog";
import {
  Building2,
  Mail,
  MapPin,
  User,
  Linkedin,
  Calendar,
  FileText,
  AlertTriangle,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";

interface ContactDetailDialogProps {
  contact: DistributionContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailDialog({ contact, open, onOpenChange }: ContactDetailDialogProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteContact = useDeleteDistributionContact();

  const handleDelete = async () => {
    await deleteContact.mutateAsync(contact.id);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {contact.full_name}
              {contact.do_not_contact && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Do Not Contact
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                {contact.email}
              </a>
            </div>

            {contact.company && (
              <div className="flex items-center gap-3 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{contact.company}</span>
                {contact.job_title && (
                  <span className="text-muted-foreground">· {contact.job_title}</span>
                )}
              </div>
            )}

            {(contact.country || contact.city) && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[contact.city, contact.country].filter(Boolean).join(", ")}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{contact.gender}</span>
            </div>

            {contact.linkedin_url && (
              <div className="flex items-center gap-3 text-sm">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={contact.linkedin_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn Profile
                </a>
              </div>
            )}

            {contact.sectors.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  Sectors
                  {contact.sectors_ai_assigned && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Sparkles className="h-3 w-3" />
                      AI-assigned
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {contact.sectors.map(s => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {contact.relationship_owner && (
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  <span className="text-muted-foreground">Relationship owner:</span>{" "}
                  {contact.relationship_owner}
                </span>
              </div>
            )}

            {contact.notes && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Notes</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {contact.notes}
                </p>
              </div>
            )}

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                <span>Provenance: {contact.provenance || "Unknown"}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>
                  Created {format(new Date(contact.created_at), "d MMM yyyy")}
                  {contact.updated_at !== contact.created_at && (
                    <> · Updated {format(new Date(contact.updated_at), "d MMM yyyy")}</>
                  )}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContactFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        contact={contact}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contact.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
