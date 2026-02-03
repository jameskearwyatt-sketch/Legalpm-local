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
import { useClients, Client, BillingContact } from "@/lib/hooks/useClients";
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


interface MatterEmailData {
  matterId: string;
  matterName: string;
  clientId: string;
  clientName: string;
  feeCurrency: string;
  billingContacts: BillingContact[];
  reviewPeriodStart: Date | null; // null means "from beginning" / all time
  reviewPeriodEnd: Date;
  userNotes: string;
  generatedNarrative: string;
  currentWip: number;
  currentAr: number;
  currentPaid: number;
  totalBudgetUtilised: number; // WIP + AR + Paid (all time)
  agreedBudget: number;
  isMultiClient: boolean; // Track if this matter is multi-client
}

// Amalgamated email for multiple matters of the same client
interface AmalgamatedEmailData {
  clientId: string;
  clientName: string;
  feeCurrency: string;
  billingContacts: BillingContact[];
  matterNames: string[];
  matterIds: string[];
  combinedNarrative: string;
  isAmalgamated: boolean;
}

type WizardStep = "select-matters" | "billing-contacts" | "welcome-paragraph" | "matter-details" | "review-emails" | "complete";

const REVIEW_PERIOD_OPTIONS = [
  { value: "all", label: "From beginning (totals only)", days: -1 },
  { value: "1w", label: "Also report: past week", days: 7 },
  { value: "2w", label: "Also report: past 2 weeks", days: 14 },
  { value: "1m", label: "Also report: past month", days: 30 },
  { value: "6w", label: "Also report: past 6 weeks", days: 42 },
  { value: "2m", label: "Also report: past 2 months", days: 60 },
  { value: "custom", label: "Also report: custom period", days: 0 },
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
  const [amalgamatedNarrativeOverrides, setAmalgamatedNarrativeOverrides] = useState<Map<number, string>>(new Map());

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
      setAmalgamatedNarrativeOverrides(new Map());
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
    
    // Use properly typed billing_contacts field
    if (Array.isArray(client.billing_contacts)) {
      return client.billing_contacts;
    }
    return [];
  };

  // Get unique clients for selected matters (for billing contacts step)
  const selectedClientIds = useMemo(() => {
    const clientIds = new Set<string>();
    selectedMatterIds.forEach(matterId => {
      const matter = liveMatters.find(m => m.id === matterId);
      if (matter) {
        clientIds.add(matter.client_id);
      }
    });
    return clientIds;
  }, [selectedMatterIds, liveMatters]);

  // Check which clients are missing billing contacts
  const clientsMissingBillingContacts = useMemo(() => {
    const missing = new Set<string>();
    selectedClientIds.forEach(clientId => {
      const contacts = getClientBillingContacts(clientId);
      if (contacts.length === 0) {
        missing.add(clientId);
      }
    });
    return missing;
  }, [selectedClientIds, clientMap]);

  // Selected matters array
  const selectedMatters = useMemo(() =>
    liveMatters.filter(m => selectedMatterIds.has(m.id)),
    [liveMatters, selectedMatterIds]
  );

  // Amalgamated emails for review - group sole-client matters by client
  const emailsForReview = useMemo((): AmalgamatedEmailData[] => {
    const matterDataArray = Array.from(matterEmailData.values());
    
    // Group single-client matters by client
    const clientGroups = new Map<string, MatterEmailData[]>();
    const standaloneMultiClientMatters: MatterEmailData[] = [];
    
    matterDataArray.forEach(data => {
      if (data.isMultiClient) {
        // Multi-client matters get their own email
        standaloneMultiClientMatters.push(data);
      } else {
        // Group by client
        const existing = clientGroups.get(data.clientId) || [];
        existing.push(data);
        clientGroups.set(data.clientId, existing);
      }
    });
    
    const amalgamatedEmails: AmalgamatedEmailData[] = [];
    
    // Process client groups - amalgamate if more than one matter
    clientGroups.forEach((matters, clientId) => {
      if (matters.length === 1) {
        // Single matter for this client - no amalgamation needed
        const m = matters[0];
        amalgamatedEmails.push({
          clientId: m.clientId,
          clientName: m.clientName,
          feeCurrency: m.feeCurrency,
          billingContacts: m.billingContacts,
          matterNames: [m.matterName],
          matterIds: [m.matterId],
          combinedNarrative: m.generatedNarrative,
          isAmalgamated: false,
        });
      } else {
        // Multiple matters for this client - amalgamate
        const firstMatter = matters[0];
        // Combine narratives with matter headers (plain text formatting)
        const combinedNarrative = matters.map(m => 
          `${m.matterName.toUpperCase()}\n${"─".repeat(Math.min(m.matterName.length, 40))}\n${m.generatedNarrative}`
        ).join("\n\n");
        
        amalgamatedEmails.push({
          clientId,
          clientName: firstMatter.clientName,
          feeCurrency: firstMatter.feeCurrency,
          billingContacts: firstMatter.billingContacts,
          matterNames: matters.map(m => m.matterName),
          matterIds: matters.map(m => m.matterId),
          combinedNarrative,
          isAmalgamated: true,
        });
      }
    });
    
    // Add multi-client matters as standalone emails
    standaloneMultiClientMatters.forEach(m => {
      amalgamatedEmails.push({
        clientId: m.clientId,
        clientName: m.clientName,
        feeCurrency: m.feeCurrency,
        billingContacts: m.billingContacts,
        matterNames: [m.matterName],
        matterIds: [m.matterId],
        combinedNarrative: m.generatedNarrative,
        isAmalgamated: false,
      });
    });
    
    // Apply narrative overrides
    return amalgamatedEmails.map((email, idx) => ({
      ...email,
      combinedNarrative: amalgamatedNarrativeOverrides.get(idx) ?? email.combinedNarrative,
    }));
  }, [matterEmailData, amalgamatedNarrativeOverrides]);

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
      let reviewStart: Date | null;
      
      if (lastSent?.sent_date) {
        reviewStart = parseISO(lastSent.sent_date);
      } else {
        // Default to "from beginning" (null) if no previous email
        reviewStart = null;
      }

      const currentWip = matter.latest_snapshot?.wip_amount || 0;
      const currentAr = matter.latest_snapshot?.accounts_receivable || 0;
      const currentPaid = matter.latest_snapshot?.paid_amount || 0;

      // Calculate effective agreed budget - use the matter's effective budget
      // This accounts for manual budget overrides, different billing currencies, and line item totals
      const matterAny = matter as any;
      const useManualBudget = matterAny.use_manual_budget ?? false;
      const manualBudgetAmount = matterAny.manual_budget_amount ?? 0;
      const differentBillingCurrency = matterAny.different_billing_currency ?? false;
      const agreedBillingAmount = matterAny.agreed_billing_amount ?? 0;
      const feeUpperEnd = matter.fee_amount_upper_end ?? 0;
      const bmFeeComponent = matter.bm_fee_component ?? 0;
      const localCounselFee = matter.local_counsel_fee ?? 0;
      
      // Priority: manual override > agreed billing amount (for different currency) > sum of BM + LC components > fee upper end
      let effectiveAgreedBudget = 0;
      if (useManualBudget && manualBudgetAmount > 0) {
        effectiveAgreedBudget = manualBudgetAmount + localCounselFee;
      } else if (differentBillingCurrency && agreedBillingAmount > 0) {
        effectiveAgreedBudget = agreedBillingAmount;
      } else if (bmFeeComponent > 0 || localCounselFee > 0) {
        effectiveAgreedBudget = bmFeeComponent + localCounselFee;
      } else if (feeUpperEnd > 0) {
        effectiveAgreedBudget = feeUpperEnd;
      } else {
        effectiveAgreedBudget = matter.agreed_budget_amount ?? 0;
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
        currentWip,
        currentAr,
        currentPaid,
        totalBudgetUtilised: currentWip + currentAr + currentPaid,
        agreedBudget: effectiveAgreedBudget,
        isMultiClient: (matter as any).is_multi_client || false,
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

  // Generate narratives for all matters
  const generateNarratives = async () => {
    setIsGenerating(true);

    try {
      // Fetch snapshot history for analysis
      const matterIds = Array.from(matterEmailData.keys());
      
      const mattersForAnalysis = await Promise.all(
        matterIds.map(async (matterId) => {
          const data = matterEmailData.get(matterId)!;
          
          let startSnapshot = null;
          
          // Only fetch start snapshot if we have a period start date (not "all time")
          if (data.reviewPeriodStart) {
            // Fetch the most recent snapshot AT or BEFORE the review period start
            const { data: startSnapshots } = await supabase
              .from("financial_snapshot_history")
              .select("*")
              .eq("matter_id", matterId)
              .lte("as_of_date", format(data.reviewPeriodStart, "yyyy-MM-dd"))
              .order("as_of_date", { ascending: false })
              .limit(1);

            startSnapshot = startSnapshots?.[0] || null;
          }

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
            endSnapshot: null,
            currentWip: data.currentWip,
            currentAr: data.currentAr,
            currentPaid: data.currentPaid,
            totalBudgetUtilised: data.totalBudgetUtilised,
            agreedBudget: data.agreedBudget,
            // reviewPeriodDays: null means "from beginning" / all time
            reviewPeriodDays: data.reviewPeriodStart 
              ? differenceInDays(data.reviewPeriodEnd, data.reviewPeriodStart)
              : null,
            userNotes: data.userNotes,
          };
        })
      );

      // Call edge function
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-wip-changes", {
        body: {
          matters: mattersForAnalysis,
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
      // Use the amalgamated emails for export
      const emails = emailsForReview;
      
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
        
        // For amalgamated emails, list the matter names at the top
        if (emailData.isAmalgamated) {
          fullBody += `This update covers the following matters:\n`;
          emailData.matterNames.forEach(name => {
            fullBody += `• ${name}\n`;
          });
          fullBody += `\n`;
        }
        
        if (welcomeParagraph) {
          fullBody += `${welcomeParagraph}\n\n`;
        }
        fullBody += emailData.combinedNarrative;
        
        // Standard closing paragraph - always added
        const closingParagraph = `Please do let me know if it would be helpful to discuss these figures or if you would like any further information.\n\nKind regards,`;
        fullBody += `\n\n${closingParagraph}`;
        console.log("Added closing paragraph to email body");
        
        if (emailSignature) {
          fullBody += `\n\n${emailSignature}`;
        }

        // Subject line - generic for amalgamated, specific for single matter
        const subject = emailData.isAmalgamated 
          ? `Work in Progress Update - ${emailData.clientName}`
          : `Budget Utilization Update - ${emailData.matterNames[0]}`;

        // Log the email for each matter in the amalgamated email
        for (const matterId of emailData.matterIds) {
          const matterData = matterEmailData.get(matterId);
          const periodStartForLog = matterData?.reviewPeriodStart 
            ? format(matterData.reviewPeriodStart, "yyyy-MM-dd")
            : "1900-01-01";

          await createLogEntry.mutateAsync({
            matter_id: matterId,
            client_id: emailData.clientId,
            recipient_emails: recipientEmails,
            recipient_names: recipientNames,
            subject,
            body: fullBody,
            review_period_start: periodStartForLog,
            review_period_end: format(matterData?.reviewPeriodEnd || new Date(), "yyyy-MM-dd"),
            welcome_template_id: selectedTemplateId,
          });
        }

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

    let startDate: Date | null;
    if (option === "all") {
      // "From beginning" - no period comparison, just totals
      startDate = null;
    } else if (option === "custom" && customDate) {
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

  // Update amalgamated email narrative
  const updateAmalgamatedNarrative = (emailIndex: number, narrative: string) => {
    setAmalgamatedNarrativeOverrides(prev => {
      const next = new Map(prev);
      next.set(emailIndex, narrative);
      return next;
    });
  };

  // Regenerate single email
  const regenerateSingleEmail = async (matterId: string) => {
    const data = matterEmailData.get(matterId);
    if (!data) return;

    setIsGenerating(true);
    try {
      let startSnapshot = null;
      
      // Only fetch start snapshot if we have a period start date (not "all time")
      if (data.reviewPeriodStart) {
        const { data: startSnapshots } = await supabase
          .from("financial_snapshot_history")
          .select("*")
          .eq("matter_id", matterId)
          .lte("as_of_date", format(data.reviewPeriodStart, "yyyy-MM-dd"))
          .order("as_of_date", { ascending: false })
          .limit(1);

        startSnapshot = startSnapshots?.[0] || null;
      }

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
            endSnapshot: null,
            currentWip: data.currentWip,
            currentAr: data.currentAr,
            currentPaid: data.currentPaid,
            totalBudgetUtilised: data.totalBudgetUtilised,
            reviewPeriodDays: data.reviewPeriodStart 
              ? differenceInDays(data.reviewPeriodEnd, data.reviewPeriodStart)
              : null,
            userNotes: data.userNotes,
          }],
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
        // Always go to billing contacts step so users can review/edit contacts
        setStep("billing-contacts");
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
        setStep("billing-contacts");
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
            {clientsMissingBillingContacts.size > 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {clientsMissingBillingContacts.size} client{clientsMissingBillingContacts.size !== 1 ? 's' : ''} need{clientsMissingBillingContacts.size === 1 ? 's' : ''} at least one billing contact before you can proceed.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  All clients have billing contacts. You can add additional contacts or proceed to the next step.
                </AlertDescription>
              </Alert>
            )}
            <ScrollArea className="h-[400px]">
              <div className="space-y-6 pr-4">
                {Array.from(selectedClientIds).map(clientId => {
                  const client = clientMap.get(clientId);
                  if (!client) return null;
                  const billingContacts = getClientBillingContacts(clientId);
                  const isMissingContacts = clientsMissingBillingContacts.has(clientId);
                  
                  return (
                    <Card key={clientId} className={cn(isMissingContacts && "border-destructive")}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{getClientDisplayName(client)}</span>
                          </div>
                          {isMissingContacts ? (
                            <Badge variant="destructive" className="text-xs">
                              No contacts
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              {billingContacts.length} contact{billingContacts.length !== 1 ? 's' : ''}
                            </Badge>
                          )}
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
                  // daysSinceStart is null for "from beginning" mode
                  const daysSinceStart = data.reviewPeriodStart 
                    ? differenceInDays(new Date(), data.reviewPeriodStart)
                    : -1; // -1 matches the "all" option
                  
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
                              {data.reviewPeriodStart 
                                ? `From: ${format(data.reviewPeriodStart, "d MMM yyyy")}`
                                : "From: Beginning of matter"}
                            </p>
                          </div>
                          
                          {data.reviewPeriodStart && (
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
                          )}
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
              {!currentEmail.isAmalgamated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateSingleEmail(currentEmail.matterIds[0])}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Regenerate
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {currentEmail.isAmalgamated ? "Matters" : "Matter"}
                  </Label>
                  {currentEmail.isAmalgamated ? (
                    <div className="space-y-1">
                      {currentEmail.matterNames.map((name, idx) => (
                        <p key={idx} className="font-medium">• {name}</p>
                      ))}
                      <Badge variant="secondary" className="mt-2">Amalgamated Email</Badge>
                    </div>
                  ) : (
                    <p className="font-medium">{currentEmail.matterNames[0]}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <p className="text-sm">
                    {currentEmail.billingContacts.map(c => `${formatDisplayName(c.name)} <${c.email}>`).join("; ")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="text-sm">
                    {currentEmail.isAmalgamated 
                      ? `Work in Progress Update - ${currentEmail.clientName}`
                      : `${currentEmail.matterNames[0]} - Work in Progress Financial Update`}
                  </p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="mt-2 p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                    <p className="font-medium mb-2">
                      Dear {currentEmail.billingContacts.map(c => formatDisplayName(c.name).split(" ")[0]).join(", ")},
                    </p>
                    {currentEmail.isAmalgamated && (
                      <div className="mb-3">
                        <p>This update covers the following matters:</p>
                        {currentEmail.matterNames.map((name, idx) => (
                          <p key={idx}>• {name}</p>
                        ))}
                      </div>
                    )}
                    {welcomeParagraph && (
                      <p className="mb-3">{welcomeParagraph}</p>
                    )}
                    <Textarea
                      value={currentEmail.combinedNarrative}
                      onChange={(e) => updateAmalgamatedNarrative(currentEmailIndex, e.target.value)}
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
