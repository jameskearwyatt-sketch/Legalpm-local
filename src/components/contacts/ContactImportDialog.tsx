import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useBulkCreateDistributionContacts, type DistributionContactInsert } from "@/lib/hooks/useDistributionContacts";
import { useDistributionSectors } from "@/lib/hooks/useDistributionSectors";
import { useDistributionRelationshipOwners, useEnsureRelationshipOwner } from "@/lib/hooks/useDistributionRelationshipOwners";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Loader2, FileSpreadsheet, X, Sparkles, AlertTriangle, ChevronsUpDown, Check, User } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ColumnMapping {
  [header: string]: {
    field: string;
    combineWith?: string;
  };
}

interface AIParseResult {
  mapping: ColumnMapping;
  confidence: "high" | "medium" | "low";
  notes?: string;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [activeTab, setActiveTab] = useState("paste");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiMapping, setAiMapping] = useState<AIParseResult | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parseStep, setParseStep] = useState<"select" | "review" | "importing">("select");
  const [defaultOwner, setDefaultOwner] = useState<string>("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = useBulkCreateDistributionContacts();
  const logActivity = useLogDistributionActivity();
  const { data: sectors = [] } = useDistributionSectors();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const ensureOwner = useEnsureRelationshipOwner();

  const filteredOwners = relationshipOwners.filter(o =>
    o.name.toLowerCase().includes(ownerSearch.toLowerCase())
  );

  const normaliseGender = (value: string | undefined): 'male' | 'female' | 'unknown' => {
    if (!value) return 'unknown';
    const lower = value.toLowerCase().trim();
    if (lower === 'm' || lower === 'male' || lower === 'man') return 'male';
    if (lower === 'f' || lower === 'female' || lower === 'woman') return 'female';
    return 'unknown';
  };

  const applyMappingToRow = (row: Record<string, string>, mapping: ColumnMapping, fallbackOwner?: string): DistributionContactInsert | null => {
    const contact: Partial<DistributionContactInsert> = {
      sectors: [],
      sectors_ai_assigned: false,
      do_not_contact: false,
      provenance: selectedFile ? `File import: ${selectedFile.name}` : "Pasted import",
      relationship_owner: fallbackOwner || null,
    };

    // Track first/last name for combining
    let firstName = "";
    let lastName = "";

    Object.entries(mapping).forEach(([header, config]) => {
      const value = row[header]?.trim() || "";
      if (!value || config.field === "ignore") return;

      switch (config.field) {
        case "first_name":
          firstName = value;
          break;
        case "last_name":
          lastName = value;
          break;
        case "full_name":
          contact.full_name = value;
          break;
        case "email":
          contact.email = value.toLowerCase();
          break;
        case "company":
          contact.company = value;
          break;
        case "job_title":
          contact.job_title = value;
          break;
        case "country":
          contact.country = value;
          break;
        case "city":
          contact.city = value;
          break;
        case "gender":
          contact.gender = normaliseGender(value);
          break;
        case "linkedin_url":
          contact.linkedin_url = value;
          break;
        case "relationship_owner":
          // Only override if the row has a value
          if (value) {
            contact.relationship_owner = value;
          }
          break;
        case "sectors":
          // AI should have mapped to valid sectors
          const sectorNames = sectors.map(s => s.name.toLowerCase());
          const inputSectors = value.split(/[,;]/).map(s => s.trim());
          contact.sectors = inputSectors.filter(s => 
            sectorNames.includes(s.toLowerCase())
          );
          if (contact.sectors && contact.sectors.length > 0) {
            contact.sectors_ai_assigned = true;
          }
          break;
      }
    });

    // Combine first + last name if we have them
    if (firstName || lastName) {
      contact.full_name = [firstName, lastName].filter(Boolean).join(" ");
    }

    // Validate required fields
    if (!contact.email || !contact.email.includes("@")) return null;
    if (!contact.full_name) contact.full_name = "Unknown";

    return {
      full_name: contact.full_name,
      email: contact.email,
      company: contact.company || null,
      job_title: contact.job_title || null,
      country: contact.country || null,
      city: contact.city || null,
      gender: contact.gender || "unknown",
      sectors: contact.sectors || [],
      sectors_ai_assigned: contact.sectors_ai_assigned || false,
      linkedin_url: contact.linkedin_url || null,
      notes: null,
      relationship_owner: contact.relationship_owner || null,
      do_not_contact: false,
      provenance: contact.provenance || "Import",
    };
  };

  const parseExcelFile = async (file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { 
            defval: '',
            raw: false,
          });

          if (jsonData.length === 0) {
            reject(new Error("No data found in file"));
            return;
          }

          const headers = Object.keys(jsonData[0]);
          resolve({ headers, rows: jsonData });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const analyseWithAI = async (headers: string[], sampleRows: Record<string, string>[]) => {
    const { data, error } = await supabase.functions.invoke('parse-contact-columns', {
      body: {
        headers,
        sampleRows,
        availableSectors: sectors.map(s => s.name),
      },
    });

    if (error) throw error;
    return data as AIParseResult;
  };

  const handleFileAnalyse = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const { headers, rows } = await parseExcelFile(selectedFile);
      setParsedData(rows);

      toast.info("Analysing columns with AI...");
      const mapping = await analyseWithAI(headers, rows.slice(0, 5));
      setAiMapping(mapping);
      setParseStep("review");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyse file. Check the format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportWithMapping = async () => {
    if (!aiMapping) return;

    setParseStep("importing");
    setIsProcessing(true);

    try {
      // Ensure the default owner exists in the database
      if (defaultOwner) {
        await ensureOwner.mutateAsync(defaultOwner);
      }

      const contacts = parsedData
        .map(row => applyMappingToRow(row, aiMapping.mapping, defaultOwner))
        .filter((c): c is DistributionContactInsert => c !== null);

      if (contacts.length === 0) {
        toast.error("No valid contacts found after mapping.");
        setParseStep("review");
        return;
      }

      await bulkCreate.mutateAsync(contacts);
      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from ${selectedFile?.name || "file"} (AI-assisted)`,
        metadata: { count: contacts.length, source: "file", ai_confidence: aiMapping.confidence, owner: defaultOwner || null },
      });

      resetDialog();
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
      setParseStep("review");
    } finally {
      setIsProcessing(false);
    }
  };

  const parsePastedText = (text: string, owner?: string): DistributionContactInsert[] => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const firstLine = lines[0]?.toLowerCase() || '';
    const hasHeaders = firstLine.includes('name') || firstLine.includes('email');
    const dataLines = hasHeaders ? lines.slice(1) : lines;

    return dataLines.map(line => {
      const parts = line.split(/[,\t]/).map(p => p.trim());
      const emailPart = parts.find(p => p.includes("@")) || "";
      const namePart = parts.find(p => !p.includes("@") && p.length > 0) || "Unknown";
      
      return {
        full_name: namePart,
        email: emailPart.toLowerCase(),
        company: null,
        job_title: null,
        country: null,
        city: null,
        gender: "unknown" as const,
        sectors: [],
        sectors_ai_assigned: false,
        linkedin_url: null,
        notes: null,
        relationship_owner: owner || null,
        do_not_contact: false,
        provenance: "Pasted import",
      };
    }).filter(c => c.email);
  };

  const handlePasteImport = async () => {
    if (!pastedText.trim()) {
      toast.error("Please paste some contact data");
      return;
    }

    setIsProcessing(true);
    try {
      // Ensure the default owner exists in the database
      if (defaultOwner) {
        await ensureOwner.mutateAsync(defaultOwner);
      }

      const contacts = parsePastedText(pastedText, defaultOwner);
      if (contacts.length === 0) {
        toast.error("No valid contacts found.");
        return;
      }

      await bulkCreate.mutateAsync(contacts);
      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from pasted text`,
        metadata: { count: contacts.length, source: "paste", owner: defaultOwner || null },
      });

      resetDialog();
      onOpenChange(false);
    } catch (error) {
      toast.error("Import failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (hasValidExtension) {
        setSelectedFile(file);
        setAiMapping(null);
        setParseStep("select");
      } else {
        toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
      }
    }
  };

  const resetDialog = () => {
    setPastedText("");
    setSelectedFile(null);
    setAiMapping(null);
    setParsedData([]);
    setParseStep("select");
    setDefaultOwner("");
    setOwnerSearch("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    setAiMapping(null);
    setParsedData([]);
    setParseStep("select");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getMappedFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      full_name: "Full Name",
      first_name: "First Name",
      last_name: "Last Name",
      email: "Email",
      company: "Company",
      job_title: "Job Title",
      country: "Country",
      city: "City",
      gender: "Gender",
      linkedin_url: "LinkedIn",
      relationship_owner: "Relationship Owner",
      sectors: "Sectors",
      ignore: "Ignored",
    };
    return labels[field] || field;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import Contacts
            {parseStep === "review" && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                AI-Assisted
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {parseStep === "select" && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paste" className="gap-2">
                <FileText className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-4 mt-4">
              <div>
                <Label>Paste contact data</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Paste names and emails, one per line. Supports CSV format.
                </p>
                <Textarea
                  rows={8}
                  placeholder="John Smith, john@example.com&#10;Jane Doe, jane@example.com"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                />
              </div>
              
              {/* Owner selector for paste */}
              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact Owner
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Assign a relationship owner to all imported contacts.
                </p>
                <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {defaultOwner || "Select or type owner name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search or add owner..."
                        value={ownerSearch}
                        onValueChange={setOwnerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {ownerSearch && (
                            <button
                              type="button"
                              className="w-full p-2 text-left hover:bg-accent text-sm"
                              onClick={() => {
                                setDefaultOwner(ownerSearch);
                                setOwnerPopoverOpen(false);
                              }}
                            >
                              Add "{ownerSearch}" as new owner
                            </button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredOwners.map((owner) => (
                            <CommandItem
                              key={owner.id}
                              value={owner.name}
                              onSelect={() => {
                                setDefaultOwner(owner.name);
                                setOwnerPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  defaultOwner === owner.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {owner.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4 mt-4">
              <div>
                <Label>Upload Excel or CSV file</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  AI will intelligently detect columns including First Name + Surname combinations.
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors text-center"
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to select file</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports .xlsx, .xls, .csv
                    </p>
                  </button>
                )}
              </div>
              
              {/* Owner selector for file upload */}
              <div>
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Default Contact Owner
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Assign an owner to contacts without one in the file.
                </p>
                <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {defaultOwner || "Select or type owner name..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search or add owner..."
                        value={ownerSearch}
                        onValueChange={setOwnerSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {ownerSearch && (
                            <button
                              type="button"
                              className="w-full p-2 text-left hover:bg-accent text-sm"
                              onClick={() => {
                                setDefaultOwner(ownerSearch);
                                setOwnerPopoverOpen(false);
                              }}
                            >
                              Add "{ownerSearch}" as new owner
                            </button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredOwners.map((owner) => (
                            <CommandItem
                              key={owner.id}
                              value={owner.name}
                              onSelect={() => {
                                setDefaultOwner(owner.name);
                                setOwnerPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  defaultOwner === owner.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {owner.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {parseStep === "review" && aiMapping && (
          <div className="space-y-4">
            <Alert className={aiMapping.confidence === "high" ? "border-green-200 bg-green-50" : aiMapping.confidence === "medium" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium capitalize">{aiMapping.confidence} confidence</span>
                {aiMapping.notes && <span className="ml-1">— {aiMapping.notes}</span>}
              </AlertDescription>
            </Alert>

            <div>
              <Label className="mb-2 block">Column Mapping</Label>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {Object.entries(aiMapping.mapping).map(([header, config]) => (
                  <div key={header} className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                    <span className="text-sm font-medium truncate flex-1">{header}</span>
                    <Badge 
                      variant={config.field === "ignore" ? "outline" : "secondary"}
                      className="ml-2"
                    >
                      {getMappedFieldLabel(config.field)}
                      {config.combineWith && ` + ${config.combineWith}`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{parsedData.length} rows found</span>
              <Button variant="link" size="sm" onClick={() => setParseStep("select")}>
                ← Back to file selection
              </Button>
            </div>
          </div>
        )}

        {parseStep === "importing" && (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Importing contacts...</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {parseStep === "select" && activeTab === "paste" && (
            <Button onClick={handlePasteImport} disabled={isProcessing || !pastedText.trim()}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import Contacts
            </Button>
          )}
          
          {parseStep === "select" && activeTab === "file" && (
            <Button onClick={handleFileAnalyse} disabled={isProcessing || !selectedFile} className="gap-2">
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              <Sparkles className="h-4 w-4" />
              Analyse with AI
            </Button>
          )}

          {parseStep === "review" && (
            <Button onClick={handleImportWithMapping} disabled={isProcessing}>
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {parsedData.length} Contacts
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
