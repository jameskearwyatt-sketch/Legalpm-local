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
import { useContactImportFormats, ContactColumnMappings } from "@/lib/hooks/useContactImportFormats";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { ContactFormatTrainingDialog } from "./ContactFormatTrainingDialog";
import { Upload, FileText, Loader2, FileSpreadsheet, X, ChevronsUpDown, Check, User } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [activeTab, setActiveTab] = useState("paste");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parseStep, setParseStep] = useState<"select" | "training" | "importing">("select");
  const [defaultOwner, setDefaultOwner] = useState<string>("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = useBulkCreateDistributionContacts();
  const logActivity = useLogDistributionActivity();
  const { data: sectors = [] } = useDistributionSectors();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const ensureOwner = useEnsureRelationshipOwner();
  const { findMatchingFormat, saveFormat, createHeaderSignature } = useContactImportFormats();

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

  // Apply column index mappings to a row
  const applyIndexMappingToRow = (
    row: Record<string, string>, 
    headers: string[],
    mappings: ContactColumnMappings, 
    fallbackOwner?: string
  ): DistributionContactInsert | null => {
    const getValue = (fieldIndex: number | undefined): string => {
      if (fieldIndex === undefined) return "";
      const header = headers[fieldIndex];
      return row[header]?.trim() || "";
    };

    let fullName = getValue(mappings.full_name);
    const firstName = getValue(mappings.first_name);
    const lastName = getValue(mappings.last_name);
    
    // Combine first + last if we have them
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(" ");
    }

    const email = getValue(mappings.email).toLowerCase();
    
    // Validate required fields
    if (!email || !email.includes("@")) return null;
    if (!fullName) fullName = "Unknown";

    // Parse sectors
    const sectorsValue = getValue(mappings.sectors);
    const sectorNames = sectors.map(s => s.name.toLowerCase());
    const parsedSectors = sectorsValue 
      ? sectorsValue.split(/[,;]/).map(s => s.trim()).filter(s => sectorNames.includes(s.toLowerCase()))
      : [];

    // Get relationship owner from row, or use fallback
    const rowOwner = getValue(mappings.relationship_owner);

    return {
      full_name: fullName,
      email,
      company: getValue(mappings.company) || null,
      job_title: getValue(mappings.job_title) || null,
      country: getValue(mappings.country) || null,
      city: getValue(mappings.city) || null,
      gender: normaliseGender(getValue(mappings.gender)),
      sectors: parsedSectors,
      sectors_ai_assigned: parsedSectors.length > 0,
      linkedin_url: getValue(mappings.linkedin_url) || null,
      notes: null,
      relationship_owner: rowOwner || fallbackOwner || null,
      do_not_contact: false,
      provenance: selectedFile ? `File import: ${selectedFile.name}` : "Import",
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
          
          // Get the range to limit rows read
          const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
          // Cap at 5000 rows maximum to prevent memory issues
          range.e.r = Math.min(range.e.r, 5000);
          firstSheet['!ref'] = XLSX.utils.encode_range(range);
          
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { 
            defval: '',
            raw: false,
          });

          if (jsonData.length === 0) {
            reject(new Error("No data found in file"));
            return;
          }

          // Get headers from first row
          const headers = Object.keys(jsonData[0]);

          // Filter out empty rows - require at least one non-empty value in a key column
          // (not just any cell, to avoid picking up formatting artifacts)
          const nonEmptyRows = jsonData.filter(row => {
            const values = Object.values(row);
            // Count how many cells have actual content
            const filledCells = values.filter(val => val && val.toString().trim() !== '').length;
            // Require at least 2 filled cells to be considered a valid row
            return filledCells >= 2;
          });

          if (nonEmptyRows.length === 0) {
            reject(new Error("No valid data rows found in file"));
            return;
          }

          resolve({ headers, rows: nonEmptyRows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleFileAnalyse = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const { headers, rows } = await parseExcelFile(selectedFile);
      setParsedData(rows);
      setParsedHeaders(headers);

      // Check if we recognize this format
      const matchedFormat = findMatchingFormat(headers);
      
      if (matchedFormat) {
        // Format recognized - process directly
        toast.success(`Recognized format: "${matchedFormat.format_name}". Processing ${rows.length} contacts...`);
        await processWithMappings(rows, headers, matchedFormat.column_mappings);
      } else {
        // Format not recognized - show training dialog
        toast.info(`New format detected with ${rows.length} rows. Please train the column mapping.`);
        setParseStep("training");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse file");
    } finally {
      setIsProcessing(false);
    }
  };

  const processWithMappings = async (
    rows: Record<string, string>[], 
    headers: string[],
    mappings: ContactColumnMappings
  ) => {
    setParseStep("importing");
    setIsProcessing(true);

    try {
      // Ensure the default owner exists in the database
      if (defaultOwner) {
        await ensureOwner.mutateAsync(defaultOwner);
      }

      const contacts = rows
        .map(row => applyIndexMappingToRow(row, headers, mappings, defaultOwner))
        .filter((c): c is DistributionContactInsert => c !== null);

      if (contacts.length === 0) {
        toast.error("No valid contacts found. Check that email and name columns are mapped correctly.");
        setParseStep("training");
        return;
      }

      await bulkCreate.mutateAsync(contacts);
      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from ${selectedFile?.name || "file"}`,
        metadata: { count: contacts.length, source: "file", owner: defaultOwner || null },
      });

      resetDialog();
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
      setParseStep("training");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrainingSave = async (formatName: string, mappings: ContactColumnMappings) => {
    // Save the format for future recognition
    const signature = createHeaderSignature(parsedHeaders);
    await saveFormat.mutateAsync({
      format_name: formatName,
      column_mappings: mappings,
      header_signature: signature,
      sample_headers: parsedHeaders,
    });

    // Process with the new mappings
    await processWithMappings(parsedData, parsedHeaders, mappings);
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
        setParsedData([]);
        setParsedHeaders([]);
        setParseStep("select");
      } else {
        toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
      }
    }
  };

  const resetDialog = () => {
    setPastedText("");
    setSelectedFile(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    setDefaultOwner("");
    setOwnerSearch("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Dialog open={open && parseStep !== "training"} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
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
                    Upload your file and train the system to recognize column mappings.
                    Once trained, this format will be auto-recognized in future imports.
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

          {parseStep === "importing" && (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-muted-foreground">Importing contacts...</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }}>
              Cancel
            </Button>
            {parseStep === "select" && activeTab === "paste" && (
              <Button onClick={handlePasteImport} disabled={isProcessing || !pastedText.trim()}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import
              </Button>
            )}
            {parseStep === "select" && activeTab === "file" && (
              <Button onClick={handleFileAnalyse} disabled={isProcessing || !selectedFile}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyse File
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Dialog - shown as separate dialog */}
      <ContactFormatTrainingDialog
        isOpen={parseStep === "training"}
        onClose={() => {
          setParseStep("select");
        }}
        onSave={handleTrainingSave}
        headers={parsedHeaders}
        sampleRows={parsedData}
      />
    </>
  );
}
