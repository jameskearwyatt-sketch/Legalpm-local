import { useState, useMemo, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type DistributionContact } from "@/lib/hooks/useDistributionContacts";
import { useCreateDistributionEmailDraft } from "@/lib/hooks/useDistributionEmailDrafts";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ExternalLink, AlertCircle, Users, Loader2, FileSignature, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface EmailDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: DistributionContact[];
  campaignId?: string;
}

type DeliveryMode = 'individual' | 'to_all' | 'bcc_all';

interface JapaneseDetectionResult {
  id: string;
  full_name: string;
  is_japanese: boolean;
  confidence: "high" | "medium" | "low";
  reason?: string;
}

export function EmailDraftDialog({ open, onOpenChange, contacts, campaignId }: EmailDraftDialogProps) {
  const [draftType, setDraftType] = useState<'event_invitation' | 'article_sharing' | 'firm_update'>('event_invitation');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('bcc_all');
  const [salutation, setSalutation] = useState<'Dear' | 'Hi'>('Dear');
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  
  // Track which contacts are selected (all selected by default)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(() => 
    new Set(contacts.map(c => c.id))
  );

  // Japanese detection state
  const [isAnalyzingJapanese, setIsAnalyzingJapanese] = useState(false);
  const [japaneseContacts, setJapaneseContacts] = useState<JapaneseDetectionResult[]>([]);
  const [useJapaneseFormality, setUseJapaneseFormality] = useState(true);

  const createDraft = useCreateDistributionEmailDraft();
  const { emailSignature, saveEmailSignature } = useUserSettings();
  
  // Signature editing state
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [editingSignature, setEditingSignature] = useState("");

  // Reset selected contacts when dialog opens with new contacts
  useMemo(() => {
    setSelectedContactIds(new Set(contacts.map(c => c.id)));
  }, [contacts]);

  // Analyze contacts for Japanese when dialog opens
  useEffect(() => {
    if (open && contacts.length > 0) {
      analyzeJapaneseContacts();
      // Initialize signature editing with saved signature
      setEditingSignature(emailSignature || "");
    } else if (!open) {
      // Reset state when dialog closes
      setJapaneseContacts([]);
      setUseJapaneseFormality(true);
      setIsSignatureOpen(false);
    }
  }, [open, contacts, emailSignature]);

  // Build full email body with signature
  const getFullBody = (baseBody: string): string => {
    if (emailSignature) {
      return `${baseBody}\n\n${emailSignature}`;
    }
    return baseBody;
  };

  const analyzeJapaneseContacts = async () => {
    setIsAnalyzingJapanese(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-japanese-contacts', {
        body: {
          contacts: contacts.map(c => ({
            id: c.id,
            full_name: c.full_name,
            company: c.company,
            location: c.country, // Use country field as location
          })),
        },
      });

      if (error) {
        console.error("Error detecting Japanese contacts:", error);
        setJapaneseContacts([]);
      } else {
        setJapaneseContacts(data?.results || []);
      }
    } catch (err) {
      console.error("Failed to analyze Japanese contacts:", err);
      setJapaneseContacts([]);
    } finally {
      setIsAnalyzingJapanese(false);
    }
  };

  const selectedContacts = useMemo(() => 
    contacts.filter(c => selectedContactIds.has(c.id)),
    [contacts, selectedContactIds]
  );

  const emails = selectedContacts.map(c => c.email);

  // Check if any selected contacts are Japanese
  const selectedJapaneseContacts = useMemo(() => 
    japaneseContacts.filter(jc => 
      jc.is_japanese && selectedContactIds.has(jc.id)
    ),
    [japaneseContacts, selectedContactIds]
  );

  const hasJapaneseRecipients = selectedJapaneseContacts.length > 0;

  // Create a set of Japanese contact IDs for quick lookup
  const japaneseContactIds = useMemo(() => 
    new Set(japaneseContacts.filter(jc => jc.is_japanese).map(jc => jc.id)),
    [japaneseContacts]
  );

  // Extract first name from full_name
  // Handles both "Firstname Surname" and "Surname, Firstname" formats
  const getFirstName = (fullName: string): string => {
    const trimmed = fullName.trim();
    
    // Check if name is in "Surname, Firstname" format
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',');
      if (parts.length >= 2) {
        // Take the part after the comma (firstname) and get first word
        const firstNamePart = parts[1].trim().split(/\s+/)[0];
        return firstNamePart || trimmed;
      }
    }
    
    // Otherwise assume "Firstname Surname" format
    const parts = trimmed.split(/\s+/);
    return parts[0] || trimmed;
  };

  // Get surname for Japanese addressing
  const getSurname = (fullName: string): string => {
    const trimmed = fullName.trim();
    
    // Check if name is in "Surname, Firstname" format
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',');
      // Surname is before the comma
      return parts[0].trim() || trimmed;
    }
    
    // Otherwise assume "Firstname Surname" format - surname is last part
    const parts = trimmed.split(/\s+/);
    return parts[parts.length - 1] || trimmed;
  };

  // Get the name part for a contact (for individual salutation)
  const getNameForSalutation = (contact: DistributionContact): string => {
    const isJapanese = japaneseContactIds.has(contact.id);
    
    if (isJapanese && useJapaneseFormality) {
      // Use Japanese style: Surname-san
      const surname = getSurname(contact.full_name);
      return `${surname}-san`;
    } else {
      // Use Western style: FirstName only
      return getFirstName(contact.full_name);
    }
  };

  // Get appropriate salutation for a contact (for individual emails)
  const getPersonalizedSalutation = (contact: DistributionContact): string => {
    const isJapanese = japaneseContactIds.has(contact.id);
    
    if (isJapanese && useJapaneseFormality) {
      // Use Japanese style: Surname-san (no "Dear" prefix)
      const surname = getSurname(contact.full_name);
      return `${surname}-san`;
    } else {
      // Use Western style: Dear/Hi FirstName
      const firstName = getFirstName(contact.full_name);
      return `${salutation} ${firstName}`;
    }
  };

  // Build combined salutation for "To All" mode
  // Japanese recipients appear first, then others
  const buildCombinedSalutation = (): string => {
    // Separate Japanese and non-Japanese contacts
    const japaneseRecipients = selectedContacts.filter(c => japaneseContactIds.has(c.id));
    const otherRecipients = selectedContacts.filter(c => !japaneseContactIds.has(c.id));
    
    // Build name list with Japanese first
    const orderedContacts = useJapaneseFormality 
      ? [...japaneseRecipients, ...otherRecipients]
      : selectedContacts;
    
    const names = orderedContacts.map(contact => getNameForSalutation(contact));
    
    // Format: "Dear Name1, Name2, Name3,"
    return `Dear ${names.join(", ")}`;
  };

  const toggleContact = (contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleSaveDraft = async () => {
    if (selectedContacts.length === 0) return;
    
    await createDraft.mutateAsync({
      campaign_id: campaignId || null,
      draft_type: draftType,
      delivery_mode: deliveryMode,
      subject,
      body,
      recipient_count: selectedContacts.length,
      recipient_emails: emails,
    });
    onOpenChange(false);
  };

  const handleOpenEmails = async () => {
    if (selectedContacts.length === 0) return;

    // Save draft first to log the email action
    await createDraft.mutateAsync({
      campaign_id: campaignId || null,
      draft_type: draftType,
      delivery_mode: deliveryMode,
      subject,
      body,
      recipient_count: selectedContacts.length,
      recipient_emails: emails,
    });

    if (deliveryMode === 'individual') {
      // Open mailto links with staggered timing to avoid browser blocking
      selectedContacts.forEach((contact, index) => {
        setTimeout(() => {
          const personalizedSalutation = getPersonalizedSalutation(contact);
          const fullBody = getFullBody(body);
          const personalizedBody = `${personalizedSalutation},\n\n${fullBody}`;
          const mailtoUrl = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(personalizedBody)}`;
          window.open(mailtoUrl, "_blank");
        }, index * 100); // 100ms delay between each
      });
    } else if (deliveryMode === 'to_all') {
      // All recipients in TO field, separated by semicolon and space
      // Order emails with Japanese first if using formality
      const japaneseRecipients = selectedContacts.filter(c => japaneseContactIds.has(c.id));
      const otherRecipients = selectedContacts.filter(c => !japaneseContactIds.has(c.id));
      const orderedContacts = useJapaneseFormality 
        ? [...japaneseRecipients, ...otherRecipients]
        : selectedContacts;
      
      const toList = orderedContacts.map(c => c.email).join("; ");
      const combinedSalutation = buildCombinedSalutation();
      const fullBody = getFullBody(body);
      const personalizedBody = `${combinedSalutation},\n\n${fullBody}`;
      const mailtoUrl = `mailto:${encodeURIComponent(toList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(personalizedBody)}`;
      window.open(mailtoUrl, "_blank");
    } else {
      // BCC all - recipients in BCC field
      const bccList = emails.join("; ");
      const fullBody = getFullBody(body);
      const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccList)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
      window.open(mailtoUrl, "_blank");
    }

    onOpenChange(false);
  };

  const showIndividualWarning = deliveryMode === 'individual' && selectedContacts.length > 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Draft Email ({selectedContacts.length} recipient{selectedContacts.length !== 1 ? 's' : ''})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipients
                {isAnalyzingJapanese && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analysing...
                  </span>
                )}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-xs h-7"
              >
                {selectedContactIds.size === contacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-32 rounded-md border p-2">
              <div className="space-y-1">
                {contacts.map((contact) => {
                  const isJapanese = japaneseContactIds.has(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 py-1 px-1 hover:bg-muted/50 rounded"
                    >
                      <Checkbox
                        id={`contact-${contact.id}`}
                        checked={selectedContactIds.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <label
                        htmlFor={`contact-${contact.id}`}
                        className="flex-1 text-sm cursor-pointer truncate"
                      >
                        <span className="font-medium">{contact.full_name}</span>
                        {isJapanese && (
                          <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            JP
                          </span>
                        )}
                        <span className="text-muted-foreground ml-2">{contact.email}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {selectedContacts.length === 0 && (
              <p className="text-xs text-destructive mt-1">Please select at least one recipient</p>
            )}
          </div>

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

          {(deliveryMode === 'individual' || deliveryMode === 'to_all') && (
            <>
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

              {deliveryMode === 'to_all' && (
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-sm text-muted-foreground">
                    Email will begin with: <span className="font-medium text-foreground">"Dear [all first names, separated by commas],"</span>
                  </p>
                </div>
              )}

              {/* Japanese formality option - only show if Japanese recipients detected */}
              {hasJapaneseRecipients && (
                <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg border">
                  <Checkbox
                    id="japanese-formality"
                    checked={useJapaneseFormality}
                    onCheckedChange={(checked) => setUseJapaneseFormality(checked === true)}
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="japanese-formality"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Use formal Japanese addressing for Japanese recipients
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {selectedJapaneseContacts.length} Japanese recipient{selectedJapaneseContacts.length !== 1 ? 's' : ''} detected. 
                      {deliveryMode === 'individual' 
                        ? ` When enabled, they will be addressed as "[Surname]-san" instead of "${salutation} [First Name]".`
                        : ` When enabled, Japanese names will appear first as "[Surname]-san" (e.g., "Dear Tanaka-san, Smith-san, John, Jane,").`
                      }
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {showIndividualWarning && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Opening {selectedContacts.length} emails at once may be blocked by your browser. 
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
              {(deliveryMode === 'individual' || deliveryMode === 'to_all') && (
                <span className="text-xs text-muted-foreground ml-2">
                  (salutation will be added automatically)
                </span>
              )}
            </Label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your email..."
            />
          </div>

          {/* Signature Section */}
          <Collapsible open={isSignatureOpen} onOpenChange={setIsSignatureOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                <FileSignature className="h-4 w-4" />
                {emailSignature ? 'Edit Signature' : 'Add Signature'}
                {emailSignature && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-auto">
                    Saved
                  </span>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <Textarea
                rows={5}
                value={editingSignature}
                onChange={(e) => setEditingSignature(e.target.value)}
                placeholder="Enter your signature (plain text)&#10;&#10;e.g.&#10;Best regards,&#10;John Smith&#10;Partner, Baker McKenzie&#10;+44 20 1234 5678"
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    saveEmailSignature.mutate(editingSignature);
                  }}
                  disabled={saveEmailSignature.isPending}
                  className="gap-1"
                >
                  <Save className="h-3 w-3" />
                  {saveEmailSignature.isPending ? 'Saving...' : 'Save Signature'}
                </Button>
                {emailSignature && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      saveEmailSignature.mutate("");
                      setEditingSignature("");
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your signature will be appended to all emails. It's saved to your account and will be remembered.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleSaveDraft} 
            disabled={!subject || !body || selectedContacts.length === 0}
          >
            Save Draft
          </Button>
          <Button 
            onClick={handleOpenEmails} 
            disabled={!subject || selectedContacts.length === 0} 
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            {deliveryMode === 'individual' 
              ? `Open ${selectedContacts.length} Email${selectedContacts.length !== 1 ? 's' : ''}`
              : 'Open in Email Client'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}