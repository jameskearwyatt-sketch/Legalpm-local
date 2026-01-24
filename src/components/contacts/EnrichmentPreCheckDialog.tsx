import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, AlertCircle, Mail, Building2, MapPin, Clock } from "lucide-react";

interface Contact {
  id: string;
  full_name: string;
  email: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  linkedin_url: string | null;
  last_enriched_at: string | null;
}

interface EnrichmentPreCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onEnrich: (contactIds: string[]) => void;
  isEnriching: boolean;
}

interface EnrichmentCategory {
  reason: string;
  icon: React.ReactNode;
  contacts: Contact[];
}

export function EnrichmentPreCheckDialog({
  open,
  onOpenChange,
  contacts,
  onEnrich,
  isEnriching,
}: EnrichmentPreCheckDialogProps) {
  const [enrichAll, setEnrichAll] = useState(false);

  // Categorize contacts by enrichment need
  const { needsEnrichment, alreadyComplete, categories } = useMemo(() => {
    const noEmail: Contact[] = [];
    const missingLocation: Contact[] = [];
    const missingCompany: Contact[] = [];
    const neverEnriched: Contact[] = [];
    const complete: Contact[] = [];

    for (const contact of contacts) {
      const hasEmail = !!contact.email && contact.email.trim() !== '';
      const hasCompany = !!contact.company && contact.company.trim() !== '';
      const hasLocation = (!!contact.country && contact.country.trim() !== '') || 
                          (!!contact.city && contact.city.trim() !== '');
      const wasEnriched = !!contact.last_enriched_at;

      // Check if contact needs enrichment based on selected criteria
      const issues: string[] = [];
      
      if (!hasEmail) {
        noEmail.push(contact);
        issues.push('email');
      }
      if (!hasCompany || !hasLocation) {
        if (!hasCompany) missingCompany.push(contact);
        if (!hasLocation) missingLocation.push(contact);
        issues.push('location/company');
      }
      if (!wasEnriched) {
        neverEnriched.push(contact);
        issues.push('never-enriched');
      }

      // If no issues and was enriched, it's complete
      if (issues.length === 0 && wasEnriched) {
        complete.push(contact);
      }
    }

    // Build unique set of contacts needing enrichment
    const needsEnrichmentSet = new Set<string>();
    [...noEmail, ...missingCompany, ...missingLocation, ...neverEnriched].forEach(c => {
      needsEnrichmentSet.add(c.id);
    });

    const needsEnrichmentContacts = contacts.filter(c => needsEnrichmentSet.has(c.id));

    const cats: EnrichmentCategory[] = [];
    if (noEmail.length > 0) {
      cats.push({
        reason: "No email address",
        icon: <Mail className="h-4 w-4 text-destructive" />,
        contacts: noEmail,
      });
    }
    if (missingCompany.length > 0) {
      cats.push({
        reason: "Missing company",
        icon: <Building2 className="h-4 w-4 text-warning" />,
        contacts: missingCompany,
      });
    }
    if (missingLocation.length > 0) {
      cats.push({
        reason: "Missing location",
        icon: <MapPin className="h-4 w-4 text-warning" />,
        contacts: missingLocation,
      });
    }
    if (neverEnriched.length > 0) {
      cats.push({
        reason: "Never enriched before",
        icon: <Clock className="h-4 w-4 text-muted-foreground" />,
        contacts: neverEnriched,
      });
    }

    return {
      needsEnrichment: needsEnrichmentContacts,
      alreadyComplete: complete,
      categories: cats,
    };
  }, [contacts]);

  const handleEnrich = () => {
    if (enrichAll) {
      onEnrich(contacts.map(c => c.id));
    } else {
      onEnrich(needsEnrichment.map(c => c.id));
    }
  };

  const estimatedCredits = enrichAll ? contacts.length : needsEnrichment.length;
  const savedCredits = contacts.length - estimatedCredits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Smart Enrichment Preview</DialogTitle>
          <DialogDescription>
            Review which contacts need enrichment to save API credits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-warning" />
                Needs Enrichment
              </div>
              <div className="mt-1 text-2xl font-bold">{needsEnrichment.length}</div>
              <p className="text-xs text-muted-foreground">contacts with missing data</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Already Complete
              </div>
              <div className="mt-1 text-2xl font-bold">{alreadyComplete.length}</div>
              <p className="text-xs text-muted-foreground">contacts with verified data</p>
            </div>
          </div>

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Breakdown by issue:</p>
              <div className="space-y-1.5">
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {cat.icon}
                      <span>{cat.reason}</span>
                    </div>
                    <Badge variant="secondary">{cat.contacts.length}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Override option */}
          {alreadyComplete.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-3">
              <Checkbox
                id="enrich-all"
                checked={enrichAll}
                onCheckedChange={(checked) => setEnrichAll(checked === true)}
              />
              <div className="space-y-1">
                <label htmlFor="enrich-all" className="text-sm font-medium cursor-pointer">
                  Enrich all {contacts.length} contacts anyway
                </label>
                <p className="text-xs text-muted-foreground">
                  Override smart filtering and re-enrich all selected contacts, including those already complete
                </p>
              </div>
            </div>
          )}

          {/* Credit estimation */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estimated API calls:</span>
              <span className="font-bold">{estimatedCredits}</span>
            </div>
            {savedCredits > 0 && !enrichAll && (
              <p className="text-xs text-success mt-1">
                Saving ~{savedCredits} credit{savedCredits !== 1 ? 's' : ''} by skipping complete contacts
              </p>
            )}
          </div>

          {/* Preview of contacts needing enrichment */}
          {needsEnrichment.length > 0 && needsEnrichment.length <= 10 && !enrichAll && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Contacts to enrich:</p>
              <ScrollArea className="h-24 rounded border bg-muted/20 p-2">
                <div className="space-y-1">
                  {needsEnrichment.map((contact) => (
                    <div key={contact.id} className="text-sm">
                      {contact.full_name}
                      {contact.company && <span className="text-muted-foreground"> - {contact.company}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnriching}>
            Cancel
          </Button>
          <Button 
            onClick={handleEnrich} 
            disabled={isEnriching || estimatedCredits === 0}
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enriching...
              </>
            ) : (
              `Enrich ${estimatedCredits} Contact${estimatedCredits !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
