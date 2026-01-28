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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MatterWithFinancials } from "@/lib/hooks/useMatters";
import { useClients, Client } from "@/lib/hooks/useClients";
import { useDistributionContacts } from "@/lib/hooks/useDistributionContacts";
import { useWipEmailTemplates } from "@/lib/hooks/useWipEmailTemplates";
import { useWipEmailLog } from "@/lib/hooks/useWipEmailLog";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { getClientDisplayName } from "@/lib/clientUtils";
import { formatCurrency } from "@/lib/currencyUtils";
import { formatDisplayName } from "@/lib/utils";
import { format, subDays, subWeeks, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Mail,
  Users,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CalendarIcon,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  ExternalLink,
  Check,
  FileText,
  Building2,
  Search,
} from "lucide-react";

interface WipClientUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matters: MatterWithFinancials[];
}

interface BillingContact {
  contact_id: string | null;
  name: string;
  email: string;
}

interface MatterEmailData {
  matterId: string;
  matterName: string;
  clientId: string;
  clientName: string;
  feeCurrency: string;
  billingContacts: BillingContact[];
  reviewPeriodStart: Date;
  reviewPeriodEnd: Date;
  userNotes: string;
  generatedNarrative: string;
  currentWip: number;
  currentAr: number;
  currentPaid: number;
}

type WizardStep = "select-matters" | "billing-contacts" | "welcome-paragraph" | "matter-details" | "review-emails" | "complete";

const REVIEW_PERIOD_OPTIONS = [
  { value: "1w", label: "Past week", days: 7 },
  { value: "2w", label: "Past 2 weeks", days: 14 },
  { value: "1m", label: "Past month", days: 30 },
  { value: "6w", label: "Past 6 weeks", days: 42 },
  { value: "2m", label: "Past 2 months", days: 60 },
  { value: "custom", label: "Custom date", days: 0 },
];

export function WipClientUpdateDialog({ open, onOpenChange, matters }: WipClientUpdateDialogProps) {
  const queryClient = useQueryClient();
  const { clients, updateClient } = useClients();
  const contactsQuery = useDistributionContacts();
  const contacts = contactsQuery.data || [];
  const { templates, createTemplate, defaultTemplate } = useWipEmailTemplates();
  const { log, createLogEntry, getLastSentForMatter } = useWipEmailLog();
  const { emailSignature } = useUserSettings();

  // Wizard state
  const [step, setStep] = useState<WizardStep>("select-matters");
  const [selectedMatterIds, setSelectedMatterIds] = useState<Set<string>>(new Set());
  const [matterEmailData, setMatterEmailData] = useState<Map<string, MatterEmailData>>(new Map());
  const [welcomeParagraph, setWelcomeParagraph] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Filter to only show Live matters
  const liveMatters = useMemo(() => 
    matters.filter(m => m.category === "Live"),
    [matters]
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("select-matters");
      setSelectedMatterIds(new Set());
      setMatterEmailData(new Map());
      setWelcomeParagraph(defaultTemplate?.content || "");
      setSelectedTemplateId(defaultTemplate?.id || null);
      setCurrentEmailIndex(0);
    }
  }, [open, defaultTemplate]);

  // Build client map for quick lookup
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  // Get billing contacts for a client
  const getClientBillingContacts = (clientId: string): BillingContact[] => {
    const client = clientMap.get(clientId);
    if (!client) return [];
    
    // Parse billing_contacts JSONB field
    try {
      const billingContacts = (client as any).billing_contacts;
      if (Array.isArray(billingContacts)) {
        return billingContacts as BillingContact[];
      }
    } catch {
      // Invalid JSON, return empty
    }
    return [];
  };

  // Check which clients are missing billing contacts
  const clientsMissingBillingContacts = useMemo(() => {
    const missing = new Set<string>();
    selectedMatterIds.forEach(matterId => {
      const matter = liveMatters.find(m => m.id === matterId);
      if (matter) {
        const contacts = getClientBillingContacts(matter.client_id);
        if (contacts.length === 0) {
          missing.add(matter.client_id);
        }
      }
    });
    return missing;
  }, [selectedMatterIds, liveMatters, clientMap]);

  // Selected matters array
  const selectedMatters = useMemo(() =>
    liveMatters.filter(m => selectedMatterIds.has(m.id)),
    [liveMatters, selectedMatterIds]
  );

  // Emails for review
  const emailsForReview = useMemo(() => 
    Array.from(matterEmailData.values()),
    [matterEmailData]
  );

  // Toggle matter selection
  const toggleMatter = (matterId: string) => {
    setSelectedMatterIds(prev => {
      const next = new Set(prev);
      if (next.has(matterId)) {
        next.delete(matterId);
      } else {
        next.add(matterId);
      }
      return next;
    });
  };

  // Select all matters
  const selectAllMatters = () => {
    setSelectedMatterIds(new Set(liveMatters.map(m => m.id)));
  };

  // Deselect all
  const deselectAllMatters = () => {
    setSelectedMatterIds(new Set());
  };

  // Initialize matter email data when moving to details step
  const initializeMatterData = () => {
    const newData = new Map<string, MatterEmailData>();
    
    selectedMatters.forEach(matter => {
      const client = clientMap.get(matter.client_id);
      const billingContacts = getClientBillingContacts(matter.client_id);
      
      // Determine default review period based on last sent email
      const lastSent = getLastSentForMatter(matter.id);
      let reviewStart: Date;
      
      if (lastSent?.sent_date) {
        reviewStart = parseISO(lastSent.sent_date);
      } else {
        // Default to 2 weeks ago
        reviewStart = subWeeks(new Date(), 2);
      }

      newData.set(matter.id, {
        matterId: matter.id,
        matterName: (matter as any).matter_display_name || matter.matter_name,
        clientId: matter.client_id,
        clientName: getClientDisplayName(client || matter.clients),
        feeCurrency: matter.fee_currency || "GBP",
        billingContacts,
        reviewPeriodStart: reviewStart,
        reviewPeriodEnd: new Date(),
        userNotes: "",
        generatedNarrative: "",
        currentWip: matter.latest_snapshot?.wip_amount || 0,
        currentAr: matter.latest_snapshot?.accounts_receivable || 0,
        currentPaid: matter.latest_snapshot?.paid_amount || 0,
      });
    });

    setMatterEmailData(newData);
  };

  // Add billing contact to a client
  const addBillingContactToClient = async (clientId: string, contact: BillingContact) => {
    const client = clientMap.get(clientId);
    if (!client) return;

    const existing = getClientBillingContacts(clientId);
    const updated = [...existing, contact];

    await supabase
      .from("clients")
      .update({ billing_contacts: JSON.parse(JSON.stringify(updated)) })
      .eq("id", clientId);

    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  // Remove billing contact from a client
  const removeBillingContactFromClient = async (clientId: string, email: string) => {
    const existing = getClientBillingContacts(clientId);
    const updated = existing.filter(c => c.email !== email);

    await supabase
      .from("clients")
      .update({ billing_contacts: JSON.parse(JSON.stringify(updated)) })
      .eq("id", clientId);

    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  // Generate AI narratives for all matters
  const generateNarratives = async () => {
    setIsGenerating(true);

    try {
      // Fetch snapshot history for analysis
      const matterIds = Array.from(matterEmailData.keys());
      
      const mattersForAnalysis = await Promise.all(
        matterIds.map(async (matterId) => {
          const data = matterEmailData.get(matterId)!;
          
          // Fetch snapshots within the review period
          const { data: snapshots } = await supabase
            .from("financial_snapshot_history")
            .select("*")
            .eq("matter_id", matterId)
            .gte("as_of_date", format(data.reviewPeriodStart, "yyyy-MM-dd"))
            .lte("as_of_date", format(data.reviewPeriodEnd, "yyyy-MM-dd"))
            .order("as_of_date", { ascending: true });

          const startSnapshot = snapshots?.[0] || null;
          const endSnapshot = snapshots?.[snapshots.length - 1] || null;

          return {
            matterId,
            matterName: data.matterName,
            clientName: data.clientName,
            feeCurrency: data.feeCurrency,
            startSnapshot: startSnapshot ? {
              wip_amount: startSnapshot.wip_amount,
              billed_amount: startSnapshot.billed_amount,
              paid_amount: startSnapshot.paid_amount,
              accounts_receivable: startSnapshot.accounts_receivable,
              wip_write_off_amount: startSnapshot.wip_write_off_amount,
              as_of_date: startSnapshot.as_of_date,
            } : null,
            endSnapshot: endSnapshot ? {
              wip_amount: endSnapshot.wip_amount,
              billed_amount: endSnapshot.billed_amount,
              paid_amount: endSnapshot.paid_amount,
              accounts_receivable: endSnapshot.accounts_receivable,
              wip_write_off_amount: endSnapshot.wip_write_off_amount,
              as_of_date: endSnapshot.as_of_date,
            } : null,
            currentWip: data.currentWip,
            currentAr: data.currentAr,
            currentPaid: data.currentPaid,
            reviewPeriodDays: differenceInDays(data.reviewPeriodEnd, data.reviewPeriodStart),
            userNotes: data.userNotes,
          };
        })
      );

      // Call AI edge function
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-wip-changes", {
        body: {
          matters: mattersForAnalysis,
          welcomeParagraph,
        },
      });

      if (error) throw error;

      // Update matter data with generated narratives
      const results = analysisData?.results || [];
      const newData = new Map(matterEmailData);

      results.forEach((result: { matterId: string; narrative: string }) => {
        const existing = newData.get(result.matterId);
        if (existing) {
          newData.set(result.matterId, {
            ...existing,
            generatedNarrative: result.narrative,
          });
        }
      });

      setMatterEmailData(newData);
      setStep("review-emails");
    } catch (error) {
      console.error("Failed to generate narratives:", error);
      toast.error("Failed to generate email content. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Export all emails to email client
  const exportEmails = async () => {
    setIsExporting(true);

    try {
      const emails = Array.from(matterEmailData.values());
      
      for (let i = 0; i < emails.length; i++) {
        const emailData = emails[i];
        
        // Build recipient list
        const recipientEmails = emailData.billingContacts.map(c => c.email);
        const recipientNames = emailData.billingContacts.map(c => c.name);
        
        if (recipientEmails.length === 0) continue;

        // Build greeting - all recipients in "Dear Name1, Name2," format
        const greeting = `Dear ${recipientNames.map(n => formatDisplayName(n).split(" ")[0]).join(", ")},`;
        
        // Build full email body
        let fullBody = `${greeting}\n\n`;
        if (welcomeParagraph) {
          fullBody += `${welcomeParagraph}\n\n`;
        }
        fullBody += emailData.generatedNarrative;
        
        if (emailSignature) {
          fullBody += `\n\n${emailSignature}`;
        }

        // Subject line
        const subject = `${emailData.matterName} - Work in Progress Financial Update`;

        // Log the email
        await createLogEntry.mutateAsync({
          matter_id: emailData.matterId,
          client_id: emailData.clientId,
          recipient_emails: recipientEmails,
          recipient_names: recipientNames,
          subject,
          body: fullBody,
          review_period_start: format(emailData.reviewPeriodStart, "yyyy-MM-dd"),
          review_period_end: format(emailData.reviewPeriodEnd, "yyyy-MM-dd"),
          welcome_template_id: selectedTemplateId,
        });

        // Open mailto with delay to avoid browser blocking
        setTimeout(() => {
          const toList = recipientEmails.join("; ");
          const mailtoUrl = `mailto:${encodeURIComponent(toList)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
          window.open(mailtoUrl, "_blank");
        }, i * 150);
      }

      toast.success(`${emails.length} email${emails.length !== 1 ? "s" : ""} opened in your email client`);
      setStep("complete");
    } catch (error) {
      console.error("Failed to export emails:", error);
      toast.error("Failed to export emails");
    } finally {
      setIsExporting(false);
    }
  };

  // Save current welcome paragraph as template
  const saveAsTemplate = async () => {
    if (!newTemplateName.trim() || !welcomeParagraph.trim()) return;
    
    await createTemplate.mutateAsync({
      name: newTemplateName.trim(),
      content: welcomeParagraph.trim(),
      is_default: templates.length === 0,
    });
    
    setNewTemplateName("");
  };

  // Update matter review period
  const updateMatterReviewPeriod = (matterId: string, option: string, customDate?: Date) => {
    const newData = new Map(matterEmailData);
    const existing = newData.get(matterId);
    if (!existing) return;

    let startDate: Date;
    if (option === "custom" && customDate) {
      startDate = customDate;
    } else {
      const optionData = REVIEW_PERIOD_OPTIONS.find(o => o.value === option);
      startDate = subDays(new Date(), optionData?.days || 14);
    }

    newData.set(matterId, {
      ...existing,
      reviewPeriodStart: startDate,
    });
    setMatterEmailData(newData);
  };

  // Update matter user notes
  const updateMatterNotes = (matterId: string, notes: string) => {
    const newData = new Map(matterEmailData);
    const existing = newData.get(matterId);
    if (!existing) return;

    newData.set(matterId, {
      ...existing,
      userNotes: notes,
    });
    setMatterEmailData(newData);
  };

  // Update generated narrative (for editing)
  const updateNarrative = (matterId: string, narrative: string) => {
    const newData = new Map(matterEmailData);
    const existing = newData.get(matterId);
    if (!existing) return;

    newData.set(matterId, {
      ...existing,
      generatedNarrative: narrative,
    });
    setMatterEmailData(newData);
  };

  // Regenerate single email
  const regenerateSingleEmail = async (matterId: string) => {
    const data = matterEmailData.get(matterId);
    if (!data) return;

    setIsGenerating(true);
    try {
      const { data: snapshots } = await supabase
        .from("financial_snapshot_history")
        .select("*")
        .eq("matter_id", matterId)
        .gte("as_of_date", format(data.reviewPeriodStart, "yyyy-MM-dd"))
        .lte("as_of_date", format(data.reviewPeriodEnd, "yyyy-MM-dd"))
        .order("as_of_date", { ascending: true });

      const startSnapshot = snapshots?.[0] || null;
      const endSnapshot = snapshots?.[snapshots.length - 1] || null;

      const { data: analysisData, error } = await supabase.functions.invoke("analyze-wip-changes", {
        body: {
          matters: [{
            matterId,
            matterName: data.matterName,
            clientName: data.clientName,
            feeCurrency: data.feeCurrency,
            startSnapshot: startSnapshot ? {
              wip_amount: startSnapshot.wip_amount,
              billed_amount: startSnapshot.billed_amount,
              paid_amount: startSnapshot.paid_amount,
              accounts_receivable: startSnapshot.accounts_receivable,
              wip_write_off_amount: startSnapshot.wip_write_off_amount,
              as_of_date: startSnapshot.as_of_date,
            } : null,
            endSnapshot: endSnapshot ? {
              wip_amount: endSnapshot.wip_amount,
              billed_amount: endSnapshot.billed_amount,
              paid_amount: endSnapshot.paid_amount,
              accounts_receivable: endSnapshot.accounts_receivable,
              wip_write_off_amount: endSnapshot.wip_write_off_amount,
              as_of_date: endSnapshot.as_of_date,
            } : null,
            currentWip: data.currentWip,
            currentAr: data.currentAr,
            currentPaid: data.currentPaid,
            reviewPeriodDays: differenceInDays(data.reviewPeriodEnd, data.reviewPeriodStart),
            userNotes: data.userNotes,
          }],
          welcomeParagraph,
        },
      });

      if (error) throw error;

      const result = analysisData?.results?.[0];
      if (result) {
        updateNarrative(matterId, result.narrative);
      }
      toast.success("Email regenerated");
    } catch (error) {
      console.error("Failed to regenerate:", error);
      toast.error("Failed to regenerate email");
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered contacts for autocomplete
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 10);
    const term = contactSearch.toLowerCase();
    return contacts
      .filter(c => 
        c.full_name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company && c.company.toLowerCase().includes(term))
      )
      .slice(0, 10);
  }, [contacts, contactSearch]);

  // Navigation functions
  const canProceedFromStep = (): boolean => {
    switch (step) {
      case "select-matters":
        return selectedMatterIds.size > 0;
      case "billing-contacts":
        return clientsMissingBillingContacts.size === 0;
      case "welcome-paragraph":
        return true; // Welcome paragraph is optional
      case "matter-details":
        return true;
      case "review-emails":
        return emailsForReview.length > 0;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    switch (step) {
      case "select-matters":
        if (clientsMissingBillingContacts.size > 0) {
          setStep("billing-contacts");
        } else {
          initializeMatterData();
          setStep("welcome-paragraph");
        }
        break;
      case "billing-contacts":
        initializeMatterData();
        setStep("welcome-paragraph");
        break;
      case "welcome-paragraph":
        setStep("matter-details");
        break;
      case "matter-details":
        generateNarratives();
        break;
      case "review-emails":
        exportEmails();
        break;
    }
  };

  const goToPreviousStep = () => {
    switch (step) {
      case "billing-contacts":
        setStep("select-matters");
        break;
      case "welcome-paragraph":
        if (clientsMissingBillingContacts.size > 0) {
          setStep("billing-contacts");
        } else {
          setStep("select-matters");
        }
        break;
      case "matter-details":
        setStep("welcome-paragraph");
        break;
      case "review-emails":
        setStep("matter-details");
        break;
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "select-matters":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select matters to update clients on ({selectedMatterIds.size} selected)</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllMatters}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={deselectAllMatters}>Deselect All</Button>
              </div>
            </div>
            <ScrollArea className="h-[400px] rounded-md border p-3">
              <div className="space-y-2">
                {liveMatters.map(matter => {
                  const client = clientMap.get(matter.client_id);
                  const hasContacts = getClientBillingContacts(matter.client_id).length > 0;
                    return (
                      <div
                        key={matter.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors",
                          selectedMatterIds.has(matter.id) && "bg-primary/5 border-primary/30"
                        )}
                        onClick={() => toggleMatter(matter.id)}
                      >
                        <Checkbox
                          checked={selectedMatterIds.has(matter.id)}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleMatter(matter.id)}
                        />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {(matter as any).matter_display_name || matter.matter_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {getClientDisplayName(client || matter.clients)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!hasContacts && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            No billing contact
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          WIP: {formatCurrency(matter.latest_snapshot?.wip_amount || 0, matter.fee_currency || "GBP")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );

      case "billing-contacts":
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The following clients need billing contacts before you can proceed. Add at least one billing contact for each.
              </AlertDescription>
            </Alert>
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 pr-4">
                {Array.from(clientsMissingBillingContacts).map(clientId => {
                  const client = clientMap.get(clientId);
                  if (!client) return null;
                  const billingContacts = getClientBillingContacts(clientId);
                  
                  return (
                    <Card key={clientId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{getClientDisplayName(client)}</span>
                        </div>
                        
                        {billingContacts.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {billingContacts.map((contact, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <span className="text-sm">
                                  {formatDisplayName(contact.name)} ({contact.email})
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBillingContactFromClient(clientId, contact.email)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search contacts or enter new..."
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              className="pl-9"
                            />
                          </div>
                          
                          {filteredContacts.length > 0 && contactSearch && (
                            <div className="border rounded-md max-h-32 overflow-y-auto">
                              {filteredContacts.map(contact => (
                                <button
                                  key={contact.id}
                                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                                  onClick={() => {
                                    addBillingContactToClient(clientId, {
                                      contact_id: contact.id,
                                      name: contact.full_name,
                                      email: contact.email,
                                    });
                                    setContactSearch("");
                                  }}
                                >
                                  <span className="font-medium">{formatDisplayName(contact.full_name)}</span>
                                  <span className="text-muted-foreground ml-2">{contact.email}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Input
                              placeholder="Name"
                              id={`new-name-${clientId}`}
                              className="flex-1"
                            />
                            <Input
                              placeholder="Email"
                              id={`new-email-${clientId}`}
                              type="email"
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const nameInput = document.getElementById(`new-name-${clientId}`) as HTMLInputElement;
                                const emailInput = document.getElementById(`new-email-${clientId}`) as HTMLInputElement;
                                if (nameInput?.value && emailInput?.value) {
                                  addBillingContactToClient(clientId, {
                                    contact_id: null,
                                    name: nameInput.value,
                                    email: emailInput.value,
                                  });
                                  nameInput.value = "";
                                  emailInput.value = "";
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );

      case "welcome-paragraph":
        return (
          <div className="space-y-4">
            <div>
              <Label>Welcome Paragraph</Label>
              <p className="text-sm text-muted-foreground mb-2">
                This text appears after the greeting and before the financial update in every email.
              </p>
            </div>
            
            {templates.length > 0 && (
              <div>
                <Label className="text-sm">Select saved template</Label>
                <Select
                  value={selectedTemplateId || "custom"}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      setSelectedTemplateId(null);
                    } else {
                      setSelectedTemplateId(v);
                      const template = templates.find(t => t.id === v);
                      if (template) {
                        setWelcomeParagraph(template.content);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Write custom paragraph</SelectItem>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.is_default && "(default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Textarea
              value={welcomeParagraph}
              onChange={(e) => {
                setWelcomeParagraph(e.target.value);
                setSelectedTemplateId(null);
              }}
              placeholder="I wanted to update you on the financial status of this matter to ensure we remain aligned on budget and progress..."
              className="min-h-[150px]"
            />

            <div className="flex items-center gap-2">
              <Input
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={saveAsTemplate}
                disabled={!newTemplateName.trim() || !welcomeParagraph.trim() || createTemplate.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </Button>
            </div>
          </div>
        );

      case "matter-details":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure the review period and optional notes for each matter. The AI will analyse financial changes during this period.
            </p>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4 pr-4">
                {Array.from(matterEmailData.values()).map((data, idx) => {
                  const lastSent = getLastSentForMatter(data.matterId);
                  const daysSinceStart = differenceInDays(new Date(), data.reviewPeriodStart);
                  
                  return (
                    <Card key={data.matterId}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">{data.matterName}</p>
                            <p className="text-sm text-muted-foreground">{data.clientName}</p>
                          </div>
                          <div className="text-right text-sm">
                            <p>WIP: {formatCurrency(data.currentWip, data.feeCurrency)}</p>
                            <p className="text-muted-foreground">AR: {formatCurrency(data.currentAr, data.feeCurrency)}</p>
                          </div>
                        </div>

                        {lastSent && (
                          <Alert className="mb-3">
                            <FileText className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Last update sent: {format(parseISO(lastSent.sent_date!), "d MMM yyyy")}
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Review Period</Label>
                            <Select
                              value={
                                REVIEW_PERIOD_OPTIONS.find(o => 
                                  o.days === daysSinceStart
                                )?.value || "custom"
                              }
                              onValueChange={(v) => updateMatterReviewPeriod(data.matterId, v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {REVIEW_PERIOD_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              From: {format(data.reviewPeriodStart, "d MMM yyyy")}
                            </p>
                          </div>
                          
                          <div>
                            <Label className="text-xs">Custom Start Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {format(data.reviewPeriodStart, "d MMM yyyy")}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={data.reviewPeriodStart}
                                  onSelect={(date) => date && updateMatterReviewPeriod(data.matterId, "custom", date)}
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Label className="text-xs">Additional Notes (optional - AI will polish)</Label>
                          <Textarea
                            value={data.userNotes}
                            onChange={(e) => updateMatterNotes(data.matterId, e.target.value)}
                            placeholder="e.g., Focused on due diligence, negotiating key terms with counterparty..."
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        );

      case "review-emails":
        const currentEmail = emailsForReview[currentEmailIndex];
        if (!currentEmail) return null;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentEmailIndex(Math.max(0, currentEmailIndex - 1))}
                  disabled={currentEmailIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Email {currentEmailIndex + 1} of {emailsForReview.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentEmailIndex(Math.min(emailsForReview.length - 1, currentEmailIndex + 1))}
                  disabled={currentEmailIndex === emailsForReview.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateSingleEmail(currentEmail.matterId)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate
              </Button>
            </div>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Matter</Label>
                  <p className="font-medium">{currentEmail.matterName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <p className="text-sm">
                    {currentEmail.billingContacts.map(c => `${formatDisplayName(c.name)} <${c.email}>`).join("; ")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="text-sm">{currentEmail.matterName} - Work in Progress Financial Update</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                    <p className="font-medium mb-2">
                      Dear {currentEmail.billingContacts.map(c => formatDisplayName(c.name).split(" ")[0]).join(", ")},
                    </p>
                    {welcomeParagraph && (
                      <p className="mb-3">{welcomeParagraph}</p>
                    )}
                    <Textarea
                      value={currentEmail.generatedNarrative}
                      onChange={(e) => updateNarrative(currentEmail.matterId, e.target.value)}
                      className="min-h-[120px] bg-background"
                    />
                    {emailSignature && (
                      <p className="mt-4 text-muted-foreground whitespace-pre-wrap">{emailSignature}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "complete":
        return (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium">Emails Exported</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {emailsForReview.length} email{emailsForReview.length !== 1 ? "s have" : " has"} been opened in your email client. 
              Don't forget to mark them as sent in the WIP Email Log once you've sent them.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        );
    }
  };

  // Step indicator
  const steps: { key: WizardStep; label: string }[] = [
    { key: "select-matters", label: "Select Matters" },
    { key: "billing-contacts", label: "Billing Contacts" },
    { key: "welcome-paragraph", label: "Welcome Paragraph" },
    { key: "matter-details", label: "Matter Details" },
    { key: "review-emails", label: "Review Emails" },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Update Clients on Work in Progress
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        {step !== "complete" && (
          <div className="flex items-center justify-center gap-1 py-2">
            {steps.map((s, idx) => {
              // Skip billing contacts step if not needed
              if (s.key === "billing-contacts" && clientsMissingBillingContacts.size === 0) {
                return null;
              }
              return (
                <div key={s.key} className="flex items-center">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full",
                      idx <= currentStepIndex ? "bg-primary" : "bg-muted"
                    )}
                  />
                  {idx < steps.length - 1 && (
                    <div className={cn(
                      "h-0.5 w-8",
                      idx < currentStepIndex ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4">
          {renderStepContent()}
        </div>

        {step !== "complete" && (
          <DialogFooter>
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                disabled={step === "select-matters"}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={goToNextStep}
                disabled={!canProceedFromStep() || isGenerating || isExporting}
              >
                {isGenerating || isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {step === "matter-details" ? (
                  <>Generate Emails</>
                ) : step === "review-emails" ? (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Export to Email Client
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
