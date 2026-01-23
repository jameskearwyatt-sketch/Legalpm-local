import { useState } from "react";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type DistributionContact,
  useDeleteDistributionContact,
  useDistributionContact,
  useUpdateDistributionContact,
} from "@/lib/hooks/useDistributionContacts";
import { useEnrichContact } from "@/lib/hooks/useContactEnrichment";
import { ContactFormDialog } from "./ContactFormDialog";
import { getPrimaryNaicsSector } from "@/lib/naicsUtils";
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
  Wand2,
  Loader2,
  CheckCircle,
  XCircle,
  Tags,
  ChevronDown,
  Briefcase,
  Scale,
  Users,
  Info,
} from "lucide-react";

interface ContactDetailDialogProps {
  contact: DistributionContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailDialog({ contact: initialContact, open, onOpenChange }: ContactDetailDialogProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteContact = useDeleteDistributionContact();
  const enrichContact = useEnrichContact();
  const updateContact = useUpdateDistributionContact();
  
  // Fetch fresh data so dialog auto-updates after enrichment/edits
  const { data: freshContact } = useDistributionContact(open ? initialContact.id : undefined);
  const contact = freshContact ?? initialContact;

  const handleEnrich = () => {
    enrichContact.mutate({
      contactId: contact.id,
      fullName: contact.full_name,
      email: contact.email,
      linkedinUrl: contact.linkedin_url,
      company: contact.company,
    });
  };

  const handleDelete = async () => {
    await deleteContact.mutateAsync(contact.id);
    onOpenChange(false);
  };

  const handleToggleLawFirm = (value: boolean) => {
    updateContact.mutate({
      id: contact.id,
      is_law_firm: value,
      classified_at: new Date().toISOString(),
      classification_reason: value 
        ? "Manually marked as law firm by user" 
        : "Manually unmarked as law firm by user",
    });
  };

  const handleToggleConsultant = (value: boolean) => {
    updateContact.mutate({
      id: contact.id,
      is_consultant: value,
      classified_at: new Date().toISOString(),
      classification_reason: value 
        ? "Manually marked as consultant by user" 
        : "Manually unmarked as consultant by user",
    });
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
            {/* Email with verification status */}
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                {contact.email}
              </a>
              {contact.email_status && (
                <Badge 
                  variant={contact.email_status === 'verified' ? 'default' : 'secondary'}
                  className="gap-1 text-xs"
                >
                  {contact.email_status === 'verified' ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {contact.email_status}
                </Badge>
              )}
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

            {/* Assigned Sector (NAICS) */}
            {contact.naics_codes && contact.naics_codes.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Assigned Sector (NAICS)
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {getPrimaryNaicsSector(contact.naics_codes)}
                  </Badge>
                  <span className="text-xs text-muted-foreground self-center">
                    Code: {contact.naics_codes[0]}
                  </span>
                </div>
              </div>
            )}

            {/* EMI Focus Areas */}
            {contact.emi_focus_areas && contact.emi_focus_areas.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  EMI Focus Areas
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.emi_focus_areas.map(area => (
                    <Badge key={area} variant="outline" className="text-sm">
                      {area}
                    </Badge>
                  ))}
                </div>
                {contact.emi_focus_areas_assigned_at && (
                  <p className="text-xs text-muted-foreground">
                    Assigned: {format(new Date(contact.emi_focus_areas_assigned_at), "d MMM yyyy")}
                  </p>
                )}
              </div>
            )}

            {/* Company Keywords - Collapsible */}
            {contact.company_keywords && contact.company_keywords.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium w-full hover:text-primary transition-colors">
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  Business Focus Areas ({contact.company_keywords.length})
                  <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {contact.company_keywords.map(keyword => (
                      <Badge key={keyword} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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

            {/* Classification Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="text-sm font-medium flex items-center gap-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                Contact Classification
                {contact.classified_at && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {contact.classification_reason || "Classified by AI"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(contact.classified_at), "d MMM yyyy")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-law-firm" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    Works at a Law Firm
                  </Label>
                  <Switch
                    id="is-law-firm"
                    checked={contact.is_law_firm === true}
                    onCheckedChange={handleToggleLawFirm}
                    disabled={updateContact.isPending}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="is-consultant" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Professional Consultant
                  </Label>
                  <Switch
                    id="is-consultant"
                    checked={contact.is_consultant === true}
                    onCheckedChange={handleToggleConsultant}
                    disabled={updateContact.isPending}
                  />
                </div>
              </div>
              
              {(contact.is_law_firm || contact.is_consultant) && (
                <p className="text-xs text-muted-foreground">
                  {contact.is_law_firm && contact.is_consultant 
                    ? "This contact will be excluded by both 'Exclude law firms' and 'Exclude consultants' filters."
                    : contact.is_law_firm 
                      ? "This contact will be excluded by the 'Exclude law firms' filter."
                      : "This contact will be excluded by the 'Exclude consultants' filter."}
                </p>
              )}
            </div>

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
                onClick={handleEnrich}
                disabled={enrichContact.isPending}
              >
                {enrichContact.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Enrich
              </Button>
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
