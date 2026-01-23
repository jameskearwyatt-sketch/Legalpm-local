import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDistributionContacts,
  useBulkDeleteDistributionContacts,
  useUpdateDistributionContact,
  type ContactFilters,
  type DistributionContact,
  type UpdatedTimePeriod,
} from "@/lib/hooks/useDistributionContacts";
import { useDistributionSectors } from "@/lib/hooks/useDistributionSectors";
import { getPrimaryNaicsSector } from "@/lib/naicsUtils";
import { useDistinctCountries, useDistinctCompanies } from "@/lib/hooks/useDistributionContacts";
import { useDistributionRelationshipOwners } from "@/lib/hooks/useDistributionRelationshipOwners";
import { ContactFormDialog } from "./ContactFormDialog";
import { ContactImportDialog } from "./ContactImportDialog";
import { EmailDraftDialog } from "./EmailDraftDialog";
import { ContactDetailDialog } from "./ContactDetailDialog";
import { ContactHistoryDialog } from "./ContactHistoryDialog";
import { FocusAreaAssignmentDialog } from "./FocusAreaAssignmentDialog";
import { ExclusionFilterCheckbox } from "./ExclusionFilterCheckbox";
import { SortableFilterableHeader, SortDirection } from "./SortableFilterableHeader";
import { StickyTableHeader } from "@/components/ui/sticky-table-header";
import { TableScrollControls } from "@/components/ui/table-scroll-controls";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { SmartSectorSearch } from "./SmartSectorSearch";
import { SmartMatchBadge } from "./SmartMatchBadge";
import { useSmartSectorSearch } from "@/lib/hooks/useSmartSectorSearch";
import {
  Plus,
  Search,
  Filter,
  Download,
  Mail,
  MoreVertical,
  Upload,
  X,
  XCircle,
  AlertTriangle,
  Sparkles,
  Trash2,
  Wand2,
  Loader2,
  History,
  Clock,
  Target,
  AlertCircle,
  Scale,
  Users,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { useBulkEnrichContacts } from "@/lib/hooks/useContactEnrichment";
import { useDetectEmailMismatch, useDismissEmailMismatch } from "@/lib/hooks/useEmailMismatchDetection";
import { useClassifyContacts } from "@/lib/hooks/useContactClassification";
import { GenderAssignmentDialog } from "./GenderAssignmentDialog";
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
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ColumnFilterState = Record<string, string>;

export function ContactsListView() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFocusAreaDialog, setShowFocusAreaDialog] = useState(false);
  const [selectedContact, setSelectedContact] = useState<DistributionContact | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [historyContact, setHistoryContact] = useState<{ id: string; name: string } | null>(null);
  const [showReidentifyConfirm, setShowReidentifyConfirm] = useState(false);
  const [isReidentifying, setIsReidentifying] = useState(false);

  // Sorting state
  const [sortKey, setSortKey] = useState<string | null>("full_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Column filter state
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({});

  const effectiveFilters = useMemo(() => ({
    ...filters,
    search: searchQuery || undefined,
  }), [filters, searchQuery]);

  const { data: contacts = [], isLoading } = useDistributionContacts(effectiveFilters);
  // Fetch ALL contacts (unfiltered) for populating dropdown options
  const { data: allContacts = [] } = useDistributionContacts({});
  const { data: sectors = [] } = useDistributionSectors();
  const { data: countries = [] } = useDistinctCountries();
  const { data: companies = [] } = useDistinctCompanies();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const logActivity = useLogDistributionActivity();
  const bulkDelete = useBulkDeleteDistributionContacts();
  const bulkEnrich = useBulkEnrichContacts();
  const detectMismatch = useDetectEmailMismatch();
  const dismissMismatch = useDismissEmailMismatch();
  const classifyContacts = useClassifyContacts();
  
  // Smart sector search
  const {
    searchState: smartSearchState,
    isSearching: isSmartSearching,
    isDeepSearching,
    executeQuickSearch,
    executeDeepSearch,
    clearSearch: clearSmartSearch,
    getMatchForContact,
    isContactMatched,
  } = useSmartSectorSearch();

  // Get unique values for filter dropdowns
  const uniqueOwners = useMemo(() => 
    [...new Set(contacts.map(c => c.relationship_owner).filter(Boolean) as string[])].sort(),
    [contacts]
  );

  const uniqueCompanies = useMemo(() => 
    [...new Set(contacts.map(c => c.company).filter(Boolean) as string[])].sort(),
    [contacts]
  );

  const uniqueJobTitles = useMemo(() => 
    [...new Set(contacts.map(c => c.job_title).filter(Boolean) as string[])].sort(),
    [contacts]
  );

  const uniqueCountries = useMemo(() => 
    [...new Set(contacts.map(c => c.country).filter(Boolean) as string[])].sort(),
    [contacts]
  );

  // Get unique NAICS-derived sectors for filtering (from ALL contacts, not filtered)
  const uniqueNaicsSectors = useMemo(() => {
    const sectors = new Set<string>();
    allContacts.forEach(c => {
      const sector = getPrimaryNaicsSector(c.naics_codes);
      if (sector) sectors.add(sector);
    });
    return Array.from(sectors).sort();
  }, [allContacts]);

  // Get unique EMI Focus Areas for filtering (from ALL contacts, not filtered)
  const uniqueEmiFocusAreas = useMemo(() => {
    const areas = new Set<string>();
    allContacts.forEach(c => {
      (c.emi_focus_areas || []).forEach(area => areas.add(area));
    });
    return Array.from(areas).sort();
  }, [allContacts]);

  // Apply column filters, smart search, sorting, and exclusion filters
  // NOTE: Exclusion filters (excludeLawFirms, excludeConsultants) are applied HERE
  // so they filter only the currently visible/filtered list, not the entire dataset
  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts];

    // Helper to get field value by key
    const getFieldValue = (contact: DistributionContact, key: string): unknown => {
      switch (key) {
        case 'full_name': return contact.full_name;
        case 'email': return contact.email;
        case 'company': return contact.company;
        case 'job_title': return contact.job_title;
        case 'country': return contact.country;
        case 'city': return contact.city;
        case 'relationship_owner': return contact.relationship_owner;
        case 'gender': return contact.gender;
        case 'naics_sector': return getPrimaryNaicsSector(contact.naics_codes);
        default: return null;
      }
    };

    // Apply smart sector search filter FIRST (if active)
    if (smartSearchState.isActive) {
      result = result.filter(contact => smartSearchState.matches.has(contact.id));
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (!value) return;
      const lowerValue = value.toLowerCase();
      
      result = result.filter(contact => {
        const fieldValue = getFieldValue(contact, key);
        if (fieldValue === null || fieldValue === undefined) return false;
        return String(fieldValue).toLowerCase().includes(lowerValue);
      });
    });

    // Apply sorting
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        const aVal = getFieldValue(a, sortKey);
        const bVal = getFieldValue(b, sortKey);
        
        // Handle nulls
        if (aVal === null || aVal === undefined) return sortDirection === "asc" ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortDirection === "asc" ? -1 : 1;
        
        // String comparison
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [contacts, columnFilters, sortKey, sortDirection, smartSearchState.isActive, smartSearchState.matches]);

  // Contacts BEFORE exclusion filters are applied - used for the exclusion filter popover lists
  const contactsBeforeExclusion = filteredAndSortedContacts;

  // Apply exclusion filters LAST - these filter from the currently visible list
  const contactsAfterExclusion = useMemo(() => {
    let result = [...filteredAndSortedContacts];
    
    if (filters.excludeLawFirms) {
      result = result.filter(c => c.is_law_firm !== true);
    }
    if (filters.excludeConsultants) {
      result = result.filter(c => c.is_consultant !== true);
    }
    
    return result;
  }, [filteredAndSortedContacts, filters.excludeLawFirms, filters.excludeConsultants]);

  const eligibleContacts = useMemo(() => 
    contactsAfterExclusion.filter(c => !c.do_not_contact),
    [contactsAfterExclusion]
  );

  const selectedContacts = useMemo(() => 
    contacts.filter(c => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  const dncSelected = useMemo(() => 
    selectedContacts.some(c => c.do_not_contact),
    [selectedContacts]
  );

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      // Toggle between asc and desc only (don't reset to null)
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }, [sortKey, sortDirection]);

  const handleColumnFilter = useCallback((key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contactsAfterExclusion.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleExport = async () => {
    const contactsToExport = selectedIds.size > 0 
      ? contacts.filter(c => selectedIds.has(c.id))
      : contactsAfterExclusion;

    const headers = ["Full Name", "Email", "Company", "Job Title", "Country", "City", "Gender", "Sectors", "LinkedIn", "Relationship Owner", "Do Not Contact"];
    const rows = contactsToExport.map(c => [
      c.full_name,
      c.email,
      c.company || "",
      c.job_title || "",
      c.country || "",
      c.city || "",
      c.gender,
      c.sectors.join("; "),
      c.linkedin_url || "",
      c.relationship_owner || "",
      c.do_not_contact ? "Yes" : "No",
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contacts-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    await logActivity.mutateAsync({
      activity_type: "export_generated",
      description: `Exported ${contactsToExport.length} contacts to CSV`,
      metadata: { count: contactsToExport.length },
    });

    toast.success(`Exported ${contactsToExport.length} contacts`);
  };

  const handleEmailAction = () => {
    if (dncSelected) {
      toast.error("Cannot email contacts marked as Do Not Contact");
      return;
    }
    setShowEmailDialog(true);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await bulkDelete.mutateAsync(ids);
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery("");
    setColumnFilters({});
    setSortKey("full_name");
    setSortDirection("asc");
    clearSmartSearch();
  };

  const hasActiveFilters = Object.entries(filters).some(([_, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== "";
  }) || searchQuery || Object.values(columnFilters).some(v => v) || smartSearchState.isActive;

  const hasColumnFilters = Object.values(columnFilters).some(v => v);

  const [showGenderDialog, setShowGenderDialog] = useState(false);

  const unknownGenderCount = useMemo(() => 
    contacts.filter(c => c.gender === 'unknown').length,
    [contacts]
  );

  const noFocusAreaCount = useMemo(() => 
    contacts.filter(c => !c.emi_focus_areas || c.emi_focus_areas.length === 0).length,
    [contacts]
  );

  const emailMismatchCount = useMemo(() => 
    contacts.filter(c => c.email_company_mismatch && !c.email_mismatch_dismissed).length,
    [contacts]
  );

  // Get contacts that would be excluded by law firm filter FROM THE CURRENTLY VISIBLE LIST
  const excludedLawFirmContacts = useMemo(() => 
    contactsBeforeExclusion.filter(c => c.is_law_firm === true),
    [contactsBeforeExclusion]
  );

  // Get contacts that would be excluded by consultant filter FROM THE CURRENTLY VISIBLE LIST
  const excludedConsultantContacts = useMemo(() => 
    contactsBeforeExclusion.filter(c => c.is_consultant === true),
    [contactsBeforeExclusion]
  );

  // Count unclassified contacts
  const unclassifiedCount = useMemo(() => 
    contacts.filter(c => c.classified_at === null).length,
    [contacts]
  );

  const updateContact = useUpdateDistributionContact();

  // Handler to "protect" a contact from exclusion filter (set is_law_firm or is_consultant to false)
  const handleProtectFromLawFirm = useCallback((contactId: string) => {
    updateContact.mutate({
      id: contactId,
      is_law_firm: false,
      classification_reason: "User protected from law firm exclusion",
    });
  }, [updateContact]);

  const handleProtectFromConsultant = useCallback((contactId: string) => {
    updateContact.mutate({
      id: contactId,
      is_consultant: false,
      classification_reason: "User protected from consultant exclusion",
    });
  }, [updateContact]);

  // Find protected contacts - those that were PREVIOUSLY classified as law firms or consultants
  // but were manually protected by the user (indicated by specific classification_reason values)
  const protectedContacts = useMemo(() => {
    return allContacts.filter(c => 
      c.classification_reason?.includes("User protected from law firm exclusion") ||
      c.classification_reason?.includes("User protected from consultant exclusion")
    );
  }, [allContacts]);


  const handleReidentifyProtected = useCallback(async () => {
    setIsReidentifying(true);
    try {
      // Update all protected contacts to re-include them in exclusion filters
      const updates = protectedContacts.map(contact => {
        const updateData: { id: string; is_law_firm?: boolean; is_consultant?: boolean; classification_reason: string } = {
          id: contact.id,
          classification_reason: "Re-identified by user",
        };
        if (contact.is_law_firm === false) {
          updateData.is_law_firm = true;
        }
        if (contact.is_consultant === false) {
          updateData.is_consultant = true;
        }
        return updateContact.mutateAsync(updateData);
      });
      
      await Promise.all(updates);
      toast.success(`Re-identified ${protectedContacts.length} protected contact(s)`);
      setShowReidentifyConfirm(false);
    } catch (error) {
      toast.error("Failed to re-identify some contacts");
    } finally {
      setIsReidentifying(false);
    }
  }, [protectedContacts, updateContact]);
  return (
    <div className="space-y-4">
      {/* Sticky top section - higher z-index than table headers */}
      <div className="sticky top-0 z-30 bg-background pb-2 pt-1 -mt-1 space-y-3">
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Advanced Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                !
              </Badge>
            )}
          </Button>

          {(hasActiveFilters || hasColumnFilters) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="gap-1 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Clear all
            </Button>
          )}

          <div className="flex-1" />

          {/* Smart Sector Search */}
          <SmartSectorSearch
            onSearch={executeQuickSearch}
            onDeepSearch={executeDeepSearch}
            onClear={clearSmartSearch}
            isSearching={isSmartSearching}
            isDeepSearching={isDeepSearching}
            isActive={smartSearchState.isActive}
            matchCount={smartSearchState.matches.size}
            queryUnderstanding={smartSearchState.queryUnderstanding}
          />

          {unknownGenderCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowGenderDialog(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Assign Genders ({unknownGenderCount})
            </Button>
          )}

          {noFocusAreaCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFocusAreaDialog(true)}
              className="gap-2"
            >
              <Target className="h-4 w-4" />
              EMI Focus Area ({noFocusAreaCount})
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => detectMismatch.mutate({ runAll: true })}
            disabled={detectMismatch.isPending}
            className="gap-2"
          >
            {detectMismatch.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            Check Emails
            {emailMismatchCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                {emailMismatchCount}
              </Badge>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>

          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>

        {/* Advanced filters panel - for bulk/category filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border">
            {/* Multi-select: Assigned Sector (NAICS) */}
            <MultiSelectFilter
              options={uniqueNaicsSectors}
              selected={filters.naicsSectors || []}
              onChange={(v) => setFilters(f => ({ ...f, naicsSectors: v.length > 0 ? v : undefined }))}
              placeholder="Assigned Sector"
              className="w-[200px]"
              popoverWidth="320px"
            />

            {/* Multi-select: Country */}
            <MultiSelectFilter
              options={[...countries].sort((a, b) => a.localeCompare(b))}
              selected={filters.countries || []}
              onChange={(v) => setFilters(f => ({ ...f, countries: v.length > 0 ? v : undefined }))}
              placeholder="Country"
              className="w-[160px]"
            />

            <Select
              value={filters.gender || ""}
              onValueChange={(v) => setFilters(f => ({ ...f, gender: v as ContactFilters['gender'] || undefined }))}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Multi-select: Owner */}
            <MultiSelectFilter
              options={relationshipOwners.map(r => r.name).sort((a, b) => a.localeCompare(b))}
              selected={filters.relationship_owners || []}
              onChange={(v) => setFilters(f => ({ ...f, relationship_owners: v.length > 0 ? v : undefined }))}
              placeholder="Owner"
              className="w-[160px]"
            />

            <Select
              value={filters.do_not_contact === undefined ? "" : filters.do_not_contact ? "true" : "false"}
              onValueChange={(v) => setFilters(f => ({ ...f, do_not_contact: v === "" ? undefined : v === "true" }))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="DNC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Contactable</SelectItem>
                <SelectItem value="true">Do Not Contact</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border" />

            {/* Time period filter */}
            <Select
              value={filters.updatedPeriod || ""}
              onValueChange={(v) => setFilters(f => ({ 
                ...f, 
                updatedPeriod: v as UpdatedTimePeriod || undefined 
              }))}
            >
              <SelectTrigger className="w-[160px]">
                <Clock className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Updated in..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Enriched period filter */}
            <Select
              value={filters.enrichedPeriod || ""}
              onValueChange={(v) => setFilters(f => ({ 
                ...f, 
                enrichedPeriod: v as UpdatedTimePeriod || undefined 
              }))}
            >
              <SelectTrigger className="w-[160px]">
                <Sparkles className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Enriched in..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Multi-select: EMI Focus Area */}
            {uniqueEmiFocusAreas.length > 0 && (
              <MultiSelectFilter
                options={uniqueEmiFocusAreas}
                selected={filters.emiFocusAreas || []}
                onChange={(v) => setFilters(f => ({ ...f, emiFocusAreas: v.length > 0 ? v : undefined }))}
                placeholder="EMI Focus Area"
                icon={<Target className="h-3 w-3" />}
                className="w-[180px]"
                popoverWidth="280px"
              />
            )}

            <div className="h-6 w-px bg-border" />

            {/* AI Classification Exclusion Filters */}
            <ExclusionFilterCheckbox
              label="Exclude law firms"
              checked={filters.excludeLawFirms === true}
              onCheckedChange={(checked) => setFilters(f => ({ ...f, excludeLawFirms: checked || undefined }))}
              excludedContacts={excludedLawFirmContacts}
              onProtectContact={handleProtectFromLawFirm}
              icon={<Scale className="h-3 w-3" />}
            />

            <ExclusionFilterCheckbox
              label="Exclude consultants"
              checked={filters.excludeConsultants === true}
              onCheckedChange={(checked) => setFilters(f => ({ ...f, excludeConsultants: checked || undefined }))}
              excludedContacts={excludedConsultantContacts}
              onProtectContact={handleProtectFromConsultant}
              icon={<Users className="h-3 w-3" />}
            />

            {/* Re-identify protected contacts button */}
            {protectedContacts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReidentifyConfirm(true)}
                className="gap-2 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
              >
                <RotateCcw className="h-3 w-3" />
                Re-identify Protected ({protectedContacts.length})
              </Button>
            )}

            {/* Classify button if there are unclassified contacts */}
            {unclassifiedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => classifyContacts.mutate({ classifyAll: true })}
                disabled={classifyContacts.isPending}
                className="gap-2"
              >
                {classifyContacts.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Classify ({unclassifiedCount})
              </Button>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-4 w-4" />
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Selection actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-sm font-medium">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          
          {dncSelected && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Includes DNC
            </Badge>
          )}

          <div className="flex-1" />

          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const contactsToEnrich = selectedContacts.map(c => ({
                contactId: c.id,
                fullName: c.full_name,
                email: c.email,
                linkedinUrl: c.linkedin_url,
                company: c.company,
              }));
              bulkEnrich.mutate(contactsToEnrich, {
                onSuccess: (results) => {
                  const success = results.filter(r => r.success).length;
                  const failed = results.filter(r => !r.success).length;
                  if (success > 0) {
                    toast.success(`Enriched ${success} contact${success !== 1 ? 's' : ''}`);
                  }
                  if (failed > 0) {
                    toast.error(`Failed to enrich ${failed} contact${failed !== 1 ? 's' : ''}`);
                  }
                },
              });
            }}
            disabled={bulkEnrich.isPending}
            className="gap-2"
          >
            {bulkEnrich.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Enrich
          </Button>


          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>

          <Button 
            size="sm" 
            onClick={handleEmailAction}
            disabled={dncSelected}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Draft Email
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Contacts table with sticky header and floating scroll bar */}
      <StickyTableHeader>
        <TableScrollControls>
          <div className="border rounded-lg overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10 bg-muted/50">
                    <Checkbox
                      checked={contactsAfterExclusion.length > 0 && selectedIds.size === contactsAfterExclusion.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  {/* Name: Sort + Search */}
                  <TableHead className="w-[140px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Name"
                      columnKey="full_name"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.full_name || ""}
                      onFilterChange={handleColumnFilter}
                      mode="sort-and-search"
                    />
                  </TableHead>
                  {/* Email: Search only (no sort) */}
                  <TableHead className="w-[180px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Email"
                      columnKey="email"
                      filterValue={columnFilters.email || ""}
                      onFilterChange={handleColumnFilter}
                      mode="search-only"
                    />
                  </TableHead>
                  {/* Company: Sort + Dropdown filter */}
                  <TableHead className="w-[120px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Company"
                      columnKey="company"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.company || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueCompanies}
                      mode="dropdown-filter"
                    />
                  </TableHead>
                  {/* Title: Search only (no sort) */}
                  <TableHead className="w-[120px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Title"
                      columnKey="job_title"
                      filterValue={columnFilters.job_title || ""}
                      onFilterChange={handleColumnFilter}
                      mode="search-only"
                    />
                  </TableHead>
                  {/* Owner: Sort + Dropdown filter */}
                  <TableHead className="w-[100px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Owner"
                      columnKey="relationship_owner"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.relationship_owner || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueOwners}
                      mode="dropdown-filter"
                    />
                  </TableHead>
                  {/* Country: Sort + Dropdown filter */}
                  <TableHead className="w-[90px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Country"
                      columnKey="country"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.country || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueCountries}
                      mode="dropdown-filter"
                    />
                  </TableHead>
                  {/* Sector: Sort only */}
                  <TableHead className="w-[120px] bg-muted/50">
                    <SortableFilterableHeader
                      label="Sector"
                      columnKey="naics_sector"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      mode="sort-only"
                    />
                  </TableHead>
                  <TableHead className="w-[120px] bg-muted/50">
                    <span className="text-xs font-medium">Focus Area</span>
                  </TableHead>
                  <TableHead className="w-[70px] bg-muted/50 text-center">
                    <span className="text-xs font-medium">Updated</span>
                  </TableHead>
                  <TableHead className="w-[50px] bg-muted/50"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Loading contacts...
                    </TableCell>
                  </TableRow>
                ) : contactsAfterExclusion.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {hasColumnFilters || hasActiveFilters ? "No contacts match the current filters." : "No contacts found. Add your first contact or import from a file."}
                    </TableCell>
                  </TableRow>
                ) : (
                  contactsAfterExclusion.map((contact) => (
                    <TableRow 
                      key={contact.id}
                      className={contact.do_not_contact ? "opacity-60 bg-muted/30" : ""}
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={(checked) => handleSelectOne(contact.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="truncate">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedContact(contact)}
                            className="font-medium hover:underline text-left truncate max-w-full"
                          >
                            {contact.full_name}
                          </button>
                          {contact.do_not_contact && (
                            <Badge variant="destructive" className="shrink-0 text-xs">DNC</Badge>
                          )}
                          {smartSearchState.isActive && getMatchForContact(contact.id) && (
                            <SmartMatchBadge match={getMatchForContact(contact.id)!} compact />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate text-sm">
                        {contact.email_company_mismatch && !contact.email_mismatch_dismissed ? (
                          <div className="flex items-center gap-1">
                            <span className="text-destructive font-medium truncate">{contact.email}</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dismissMismatch.mutate(contact.id);
                                    }}
                                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Email may not match company. Click to dismiss.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{contact.email}</span>
                        )}
                      </TableCell>
                      <TableCell className="truncate text-sm">{contact.company || "-"}</TableCell>
                      <TableCell className="truncate text-sm">{contact.job_title || "-"}</TableCell>
                      <TableCell className="text-muted-foreground truncate text-sm">{contact.relationship_owner || "-"}</TableCell>
                      <TableCell className="text-sm">{contact.country || "-"}</TableCell>
                      <TableCell className="text-sm truncate">
                        {getPrimaryNaicsSector(contact.naics_codes) || "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate">
                        {contact.emi_focus_areas?.length > 0 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-xs truncate max-w-[100px]">
                                    {contact.emi_focus_areas[0]}
                                  </Badge>
                                  {contact.emi_focus_areas.length > 1 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{contact.emi_focus_areas.length - 1}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-1">
                                  {contact.emi_focus_areas.map(area => (
                                    <div key={area}>{area}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                                {contact.last_enriched_at && (
                                  <Sparkles className="h-3 w-3 text-primary" />
                                )}
                                <span>
                                  {format(new Date(contact.updated_at), "d MMM")}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs space-y-1">
                                <div>Updated: {format(new Date(contact.updated_at), "d MMM yyyy HH:mm")}</div>
                                {contact.last_enriched_at && (
                                  <div className="flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Enriched: {format(new Date(contact.last_enriched_at), "d MMM yyyy HH:mm")}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setHistoryContact({ id: contact.id, name: contact.full_name })}
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem onClick={() => setSelectedContact(contact)}>
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  if (!contact.do_not_contact) {
                                    setSelectedIds(new Set([contact.id]));
                                    setShowEmailDialog(true);
                                  }
                                }}
                                disabled={contact.do_not_contact}
                              >
                                Draft Email
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TableScrollControls>
      </StickyTableHeader>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {contactsAfterExclusion.length} contact{contactsAfterExclusion.length !== 1 ? 's' : ''} 
        {contactsAfterExclusion.length !== contacts.length && (
          <> (filtered from {contacts.length})</>
        )}
        {eligibleContacts.length !== contactsAfterExclusion.length && (
          <> • {eligibleContacts.length} contactable</>
        )}
      </div>

      {/* Dialogs */}
      <ContactFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />

      <ContactImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      {showEmailDialog && (
        <EmailDraftDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contacts={selectedContacts.filter(c => !c.do_not_contact)}
        />
      )}

      {selectedContact && (
        <ContactDetailDialog
          contact={selectedContact}
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Contact{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contact{selectedIds.size !== 1 ? 's' : ''}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GenderAssignmentDialog
        open={showGenderDialog}
        onOpenChange={setShowGenderDialog}
        contacts={contacts}
      />

      {historyContact && (
        <ContactHistoryDialog
          open={!!historyContact}
          onOpenChange={(open) => !open && setHistoryContact(null)}
          contactId={historyContact.id}
          contactName={historyContact.name}
        />
      )}

      <FocusAreaAssignmentDialog
        open={showFocusAreaDialog}
        onOpenChange={setShowFocusAreaDialog}
        selectedContactIds={Array.from(selectedIds)}
        onComplete={() => setSelectedIds(new Set())}
      />

      {/* Re-identify protected contacts confirmation */}
      <AlertDialog open={showReidentifyConfirm} onOpenChange={setShowReidentifyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-identify Protected Contacts?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You have <strong>{protectedContacts.length}</strong> contact{protectedContacts.length !== 1 ? 's' : ''} that 
                you previously protected from exclusion filters.
              </p>
              <p>
                This will reset their classification so they will appear in the "Exclude law firms" 
                or "Exclude consultants" lists again.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Protected contacts: {protectedContacts.slice(0, 5).map(c => c.full_name).join(", ")}
                {protectedContacts.length > 5 && ` and ${protectedContacts.length - 5} more...`}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReidentifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReidentifyProtected}
              disabled={isReidentifying}
            >
              {isReidentifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Re-identifying...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Re-identify All
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
