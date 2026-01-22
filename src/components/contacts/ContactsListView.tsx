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
  type ContactFilters,
  type DistributionContact,
} from "@/lib/hooks/useDistributionContacts";
import { useDistributionSectors } from "@/lib/hooks/useDistributionSectors";
import { useDistinctCountries, useDistinctCompanies } from "@/lib/hooks/useDistributionContacts";
import { useDistributionRelationshipOwners } from "@/lib/hooks/useDistributionRelationshipOwners";
import { ContactFormDialog } from "./ContactFormDialog";
import { ContactImportDialog } from "./ContactImportDialog";
import { EmailDraftDialog } from "./EmailDraftDialog";
import { ContactDetailDialog } from "./ContactDetailDialog";
import { SortableFilterableHeader, SortDirection } from "./SortableFilterableHeader";
import { StickyTableHeader } from "@/components/ui/sticky-table-header";
import { TableScrollControls } from "@/components/ui/table-scroll-controls";
import {
  Plus,
  Search,
  Filter,
  Download,
  Mail,
  MoreVertical,
  Upload,
  X,
  AlertTriangle,
  Sparkles,
  Trash2,
  Wand2,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { useBulkEnrichContacts, useAssignGenders } from "@/lib/hooks/useContactEnrichment";
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

type ColumnFilterState = Record<string, string>;

export function ContactsListView() {
  const [filters, setFilters] = useState<ContactFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<DistributionContact | null>(null);
  const [showFilters, setShowFilters] = useState(false);

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
  const { data: sectors = [] } = useDistributionSectors();
  const { data: countries = [] } = useDistinctCountries();
  const { data: companies = [] } = useDistinctCompanies();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const logActivity = useLogDistributionActivity();
  const bulkDelete = useBulkDeleteDistributionContacts();
  const bulkEnrich = useBulkEnrichContacts();

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

  // Apply column filters and sorting
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
        default: return null;
      }
    };

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
  }, [contacts, columnFilters, sortKey, sortDirection]);

  const eligibleContacts = useMemo(() => 
    filteredAndSortedContacts.filter(c => !c.do_not_contact),
    [filteredAndSortedContacts]
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
      // Cycle: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortKey(null);
        setSortDirection(null);
      }
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
      setSelectedIds(new Set(filteredAndSortedContacts.map(c => c.id)));
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
      : filteredAndSortedContacts;

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
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== "") || 
    searchQuery || 
    Object.values(columnFilters).some(v => v);

  const hasColumnFilters = Object.values(columnFilters).some(v => v);

  const assignGenders = useAssignGenders();

  const unknownGenderCount = useMemo(() => 
    contacts.filter(c => c.gender === 'unknown').length,
    [contacts]
  );

  return (
    <div className="space-y-4">
      {/* Sticky top section */}
      <div className="sticky top-0 z-20 bg-background pb-2 pt-1 -mt-1 space-y-3">
        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
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
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                !
              </Badge>
            )}
          </Button>

          {hasColumnFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColumnFilters({})}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              Clear column filters
            </Button>
          )}

          <div className="flex-1" />

          {unknownGenderCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => assignGenders.mutate(contacts.map(c => ({ id: c.id, full_name: c.full_name, gender: c.gender })))}
              disabled={assignGenders.isPending}
              className="gap-2"
            >
              {assignGenders.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Assign Genders ({unknownGenderCount})
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </Button>

          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <Select
              value={filters.sectors?.[0] || ""}
              onValueChange={(v) => setFilters(f => ({ ...f, sectors: v ? [v] : undefined }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map(s => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.country || ""}
              onValueChange={(v) => setFilters(f => ({ ...f, country: v || undefined }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.gender || ""}
              onValueChange={(v) => setFilters(f => ({ ...f, gender: v as ContactFilters['gender'] || undefined }))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.relationship_owner || ""}
              onValueChange={(v) => setFilters(f => ({ ...f, relationship_owner: v || undefined }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Relationship Owner" />
              </SelectTrigger>
              <SelectContent>
                {relationshipOwners.map(r => (
                  <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.do_not_contact === undefined ? "" : filters.do_not_contact ? "true" : "false"}
              onValueChange={(v) => setFilters(f => ({ ...f, do_not_contact: v === "" ? undefined : v === "true" }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="DNC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Contactable</SelectItem>
                <SelectItem value="true">Do Not Contact</SelectItem>
              </SelectContent>
            </Select>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 min-w-[48px]">
                    <Checkbox
                      checked={filteredAndSortedContacts.length > 0 && selectedIds.size === filteredAndSortedContacts.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    <SortableFilterableHeader
                      label="Name"
                      columnKey="full_name"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.full_name || ""}
                      onFilterChange={handleColumnFilter}
                    />
                  </TableHead>
                  <TableHead className="min-w-[200px]">
                    <SortableFilterableHeader
                      label="Email"
                      columnKey="email"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.email || ""}
                      onFilterChange={handleColumnFilter}
                    />
                  </TableHead>
                  <TableHead className="min-w-[150px]">
                    <SortableFilterableHeader
                      label="Company"
                      columnKey="company"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.company || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueCompanies}
                    />
                  </TableHead>
                  <TableHead className="min-w-[150px]">
                    <SortableFilterableHeader
                      label="Job Title"
                      columnKey="job_title"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.job_title || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueJobTitles}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableFilterableHeader
                      label="Owner"
                      columnKey="relationship_owner"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.relationship_owner || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueOwners}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">Sectors</TableHead>
                  <TableHead className="min-w-[100px]">
                    <SortableFilterableHeader
                      label="Country"
                      columnKey="country"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.country || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={uniqueCountries}
                    />
                  </TableHead>
                  <TableHead className="min-w-[90px]">
                    <SortableFilterableHeader
                      label="Gender"
                      columnKey="gender"
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      filterValue={columnFilters.gender || ""}
                      onFilterChange={handleColumnFilter}
                      filterOptions={["male", "female", "unknown"]}
                    />
                  </TableHead>
                  <TableHead className="w-10 min-w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Loading contacts...
                    </TableCell>
                  </TableRow>
                ) : filteredAndSortedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {hasColumnFilters ? "No contacts match the current filters." : "No contacts found. Add your first contact or import from a file."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedContacts.map((contact) => (
                    <TableRow 
                      key={contact.id}
                      className={contact.do_not_contact ? "opacity-60 bg-muted/30" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={(checked) => handleSelectOne(contact.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedContact(contact)}
                          className="font-medium hover:underline text-left"
                        >
                          {contact.full_name}
                        </button>
                        {contact.do_not_contact && (
                          <Badge variant="destructive" className="ml-2 text-xs">DNC</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                      <TableCell>{contact.company || "-"}</TableCell>
                      <TableCell>{contact.job_title || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.relationship_owner || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.sectors.slice(0, 2).map(s => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {contact.sectors_ai_assigned && <Sparkles className="h-3 w-3 mr-1" />}
                              {s}
                            </Badge>
                          ))}
                          {contact.sectors.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{contact.sectors.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{contact.country || "-"}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{contact.gender}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
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
        Showing {filteredAndSortedContacts.length} contact{filteredAndSortedContacts.length !== 1 ? 's' : ''} 
        {filteredAndSortedContacts.length !== contacts.length && (
          <> (filtered from {contacts.length})</>
        )}
        {eligibleContacts.length !== filteredAndSortedContacts.length && (
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
    </div>
  );
}
