import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Upload,
  Copy,
  ListPlus,
  Users,
  MapPin,
  Briefcase,
  Filter,
  X,
} from "lucide-react";
import {
  useBMInternalContacts,
  useDistinctBMRegions,
  useDistinctBMOffices,
  useDistinctBMPracticeGroups,
  countExpertiseAreas,
  type BMInternalContact,
  type BMContactFilters,
} from "@/lib/hooks/useBMInternalContacts";
import { EXPERTISE_CATEGORIES, getAllExpertiseFields } from "@/lib/bmExpertiseConfig";
import { BMContactImportDialog } from "@/components/bm-contacts/BMContactImportDialog";
import { BMContactDetailRow } from "@/components/bm-contacts/BMContactDetailRow";
import { BMAddToShortlistDialog } from "@/components/bm-contacts/BMAddToShortlistDialog";
import { BMExpertiseFilterPanel } from "@/components/bm-contacts/BMExpertiseFilterPanel";
import { toast } from "sonner";

export default function BMExpertiseMap() {
  const [search, setSearch] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedPracticeGroups, setSelectedPracticeGroups] = useState<string[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showShortlistDialog, setShowShortlistDialog] = useState(false);
  const [showExpertiseFilter, setShowExpertiseFilter] = useState(false);

  const regions = useDistinctBMRegions();
  const offices = useDistinctBMOffices();
  const practiceGroups = useDistinctBMPracticeGroups();

  const filters: BMContactFilters = useMemo(() => ({
    search,
    regions: selectedRegions.length > 0 ? selectedRegions : undefined,
    offices: selectedOffices.length > 0 ? selectedOffices : undefined,
    practiceGroups: selectedPracticeGroups.length > 0 ? selectedPracticeGroups : undefined,
    expertiseAreas: selectedExpertise.length > 0 ? selectedExpertise : undefined,
  }), [search, selectedRegions, selectedOffices, selectedPracticeGroups, selectedExpertise]);

  const { data: contacts = [], isLoading } = useBMInternalContacts(filters);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleCopyEmails = () => {
    const selectedEmails = contacts
      .filter(c => selectedContacts.has(c.id) && c.email)
      .map(c => c.email)
      .join('; ');
    
    if (selectedEmails) {
      navigator.clipboard.writeText(selectedEmails);
      toast.success(`Copied ${selectedContacts.size} email${selectedContacts.size !== 1 ? 's' : ''}`);
    } else {
      toast.error('No emails to copy');
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedRegions([]);
    setSelectedOffices([]);
    setSelectedPracticeGroups([]);
    setSelectedExpertise([]);
  };

  const hasActiveFilters = search || selectedRegions.length > 0 || selectedOffices.length > 0 || 
    selectedPracticeGroups.length > 0 || selectedExpertise.length > 0;

  return (
    <AppLayout>
      <div className="p-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              BM EMI Expertise Map
            </h1>
            <p className="text-muted-foreground mt-1">
              Find Baker McKenzie EMI professionals by expertise and location
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total Contacts
            </div>
            <div className="text-2xl font-bold mt-1">{contacts.length}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              Regions
            </div>
            <div className="text-2xl font-bold mt-1">{regions.length}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              Offices
            </div>
            <div className="text-2xl font-bold mt-1">{offices.length}</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Briefcase className="h-4 w-4" />
              Practice Groups
            </div>
            <div className="text-2xl font-bold mt-1">{practiceGroups.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border p-4 mb-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, office, practice group..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Region filter */}
            <MultiSelectFilter
              placeholder="Region"
              options={regions}
              selected={selectedRegions}
              onChange={setSelectedRegions}
            />

            {/* Office filter */}
            <MultiSelectFilter
              placeholder="Office"
              options={offices}
              selected={selectedOffices}
              onChange={setSelectedOffices}
            />

            {/* Practice Group filter */}
            <MultiSelectFilter
              placeholder="Practice Group"
              options={practiceGroups}
              selected={selectedPracticeGroups}
              onChange={setSelectedPracticeGroups}
            />

            {/* Expertise filter toggle */}
            <Button
              variant={selectedExpertise.length > 0 ? "default" : "outline"}
              onClick={() => setShowExpertiseFilter(!showExpertiseFilter)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Expertise
              {selectedExpertise.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedExpertise.length}
                </Badge>
              )}
            </Button>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>

          {/* Expertise filter panel */}
          {showExpertiseFilter && (
            <BMExpertiseFilterPanel
              selected={selectedExpertise}
              onChange={setSelectedExpertise}
              onClose={() => setShowExpertiseFilter(false)}
            />
          )}
        </div>

        {/* Selection actions */}
        {selectedContacts.size > 0 && (
          <div className="bg-primary/10 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCopyEmails}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Emails
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowShortlistDialog(true)}>
                <ListPlus className="h-4 w-4 mr-2" />
                Add to Shortlist
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedContacts(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Contacts table */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Practice Group</TableHead>
                <TableHead className="text-right">Expertise Areas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet. Import from Excel to get started.'}
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <Collapsible key={contact.id} asChild open={expandedRows.has(contact.id)}>
                    <>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(contact.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => toggleContact(contact.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRows.has(contact.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">
                          {contact.first_name} {contact.surname}
                        </TableCell>
                        <TableCell>{contact.title || '-'}</TableCell>
                        <TableCell>
                          {contact.region && (
                            <Badge variant="outline">{contact.region}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{contact.office || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {contact.practice_group || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            {countExpertiseAreas(contact.expertise)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <BMContactDetailRow contact={contact} />
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <BMContactImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      <BMAddToShortlistDialog
        open={showShortlistDialog}
        onOpenChange={setShowShortlistDialog}
        contactIds={Array.from(selectedContacts)}
        onSuccess={() => setSelectedContacts(new Set())}
      />
    </AppLayout>
  );
}
