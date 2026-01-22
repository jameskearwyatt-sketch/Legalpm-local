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
import { Mail, ExternalLink } from "lucide-react";

interface EmailDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: DistributionContact[];
  campaignId?: string;
}

export function EmailDraftDialog({ open, onOpenChange, contacts, campaignId }: EmailDraftDialogProps) {
  const [draftType, setDraftType] = useState<'event_invitation' | 'article_sharing' | 'firm_update'>('event_invitation');
  const [deliveryMode, setDeliveryMode] = useState<'bcc_all' | 'individual'>('bcc_all');
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const createDraft = useCreateDistributionEmailDraft();

  const emails = contacts.map(c => c.email);

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

  const handleOpenMailto = () => {
    const bccList = emails.join(",");
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Draft Email ({contacts.length} recipients)
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
            <RadioGroup value={deliveryMode} onValueChange={(v) => setDeliveryMode(v as typeof deliveryMode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bcc_all" id="bcc" />
                <Label htmlFor="bcc" className="font-normal">One email with all recipients in BCC</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="font-normal">Individual personalised emails</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          <div>
            <Label>Body</Label>
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
          <Button onClick={handleOpenMailto} disabled={!subject} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open in Email Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
