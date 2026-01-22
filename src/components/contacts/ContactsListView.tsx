import { useState, useMemo } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
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

  const eligibleContacts = useMemo(() => 
    contacts.filter(c => !c.do_not_contact),
    [contacts]
  );

  const selectedContacts = useMemo(() => 
    contacts.filter(c => selectedIds.has(c.id)),
    [contacts, selectedIds]
  );

  const dncSelected = useMemo(() => 
    selectedContacts.some(c => c.do_not_contact),
    [selectedContacts]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(contacts.map(c => c.id)));
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
      : contacts;

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
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== "") || searchQuery;

  return (
    <div className="space-y-4">
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

        <div className="flex-1" />

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
              Clear
            </Button>
          )}
        </div>
      )}

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

      {/* Contacts table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={contacts.length > 0 && selectedIds.size === contacts.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Job Title</TableHead>
              <TableHead>Sectors</TableHead>
              <TableHead>Country</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Loading contacts...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No contacts found. Add your first contact or import from a file.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {contacts.length} contact{contacts.length !== 1 ? 's' : ''} 
        {eligibleContacts.length !== contacts.length && (
          <> ({eligibleContacts.length} contactable)</>
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
