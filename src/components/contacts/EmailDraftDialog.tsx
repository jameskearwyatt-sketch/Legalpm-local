import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type DistributionContact } from "@/lib/hooks/useDistributionContacts";
import { useCreateDistributionEmailDraft } from "@/lib/hooks/useDistributionEmailDrafts";
import { Mail, ExternalLink, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EmailDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: DistributionContact[];
  campaignId?: string;
}

type DeliveryMode = 'individual' | 'to_all' | 'bcc_all';

export function EmailDraftDialog({ open, onOpenChange, contacts, campaignId }: EmailDraftDialogProps) {
  const [draftType, setDraftType] = useState<'event_invitation' | 'article_sharing' | 'firm_update'>('event_invitation');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('bcc_all');
  const [salutation, setSalutation] = useState<'Dear' | 'Hi'>('Dear');
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const createDraft = useCreateDistributionEmailDraft();

  const emails = contacts.map(c => c.email);

  // Extract first name from full_name
  const getFirstName = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);
    return parts[0] || fullName;
  };

  const handleSaveDraft = async () => {
    await createDraft.mutateAsync({
      campaign_id: campaignId || null,
      draft_type: draftType,
      delivery_mode: deliveryMode,
      subject,
      body,
      recipient_count: contacts.length,
      recipient_emails: emails,
    });
    onOpenChange(false);
  };

  const handleOpenEmails = async () => {
    // Save draft first to log the email action
    await createDraft.mutateAsync({
      campaign_id: campaignId || null,
      draft_type: draftType,
      delivery_mode: deliveryMode,
      subject,
      body,
      recipient_count: contacts.length,
      recipient_emails: emails,
    });

    if (deliveryMode === 'individual') {
      // Open multiple mailto links for individual emails
      contacts.forEach((contact) => {
        const firstName = getFirstName(contact.full_name);
        // Salutation with single comma
        const personalizedBody = `${salutation} ${firstName},\n\n${body}`;
        const mailtoUrl = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(personalizedBody)}`;
        window.open(mailtoUrl, "_blank");
      });
    } else if (deliveryMode === 'to_all') {
      // All recipients in TO field, separated by semicolon and space
      const toList = emails.join("; ");
      const mailtoUrl = `mailto:${encodeURIComponent(toList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");
    } else {
      // BCC all - recipients in BCC field
      const bccList = emails.join("; ");
      const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoUrl, "_blank");
    }

    onOpenChange(false);
  };

  const showIndividualWarning = deliveryMode === 'individual' && contacts.length > 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Draft Email ({contacts.length} recipient{contacts.length !== 1 ? 's' : ''})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Email Type</Label>
            <Select value={draftType} onValueChange={(v) => setDraftType(v as typeof draftType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event_invitation">Event Invitation</SelectItem>
                <SelectItem value="article_sharing">Article Sharing</SelectItem>
                <SelectItem value="firm_update">Firm Update</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Delivery Mode</Label>
            <RadioGroup value={deliveryMode} onValueChange={(v) => setDeliveryMode(v as DeliveryMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="font-normal">
                  Send individual email to each contact (personalised salutation)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="to_all" id="to_all" />
                <Label htmlFor="to_all" className="font-normal">
                  One email to all selected contacts (in To field)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bcc_all" id="bcc_all" />
                <Label htmlFor="bcc_all" className="font-normal">
                  One email blind copy to all recipients (in BCC field)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {deliveryMode === 'individual' && (
            <div>
              <Label>Salutation</Label>
              <Select value={salutation} onValueChange={(v) => setSalutation(v as 'Dear' | 'Hi')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dear">Dear [First Name]</SelectItem>
                  <SelectItem value="Hi">Hi [First Name]</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Each email will begin with "{salutation} [First Name],"
              </p>
            </div>
          )}

          {showIndividualWarning && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Opening {contacts.length} emails at once may be blocked by your browser. 
                Some email clients may not open all windows.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          <div>
            <Label>
              Body
              {deliveryMode === 'individual' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (salutation will be added automatically)
                </span>
              )}
            </Label>
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email..."
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={!subject || !body}>
            Save Draft
          </Button>
          <Button onClick={handleOpenEmails} disabled={!subject} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            {deliveryMode === 'individual' 
              ? `Open ${contacts.length} Email${contacts.length !== 1 ? 's' : ''}`
              : 'Open in Email Client'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
