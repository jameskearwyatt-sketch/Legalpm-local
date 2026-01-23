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
import { type DistributionContactInsert } from "@/lib/hooks/useDistributionContacts";
import { useDistributionSectors } from "@/lib/hooks/useDistributionSectors";
import { useDistributionRelationshipOwners, useEnsureRelationshipOwner } from "@/lib/hooks/useDistributionRelationshipOwners";
import { useContactImportFormats, ContactColumnMappings } from "@/lib/hooks/useContactImportFormats";
import { ContactFormatTrainingDialog } from "./ContactFormatTrainingDialog";
import { ImportPreviewDialog } from "./ImportPreviewDialog";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Loader2, FileSpreadsheet, X, ChevronsUpDown, Check, User, CreditCard, Camera } from "lucide-react";
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parseStep, setParseStep] = useState<"select" | "training" | "preview">("select");
  const [defaultOwner, setDefaultOwner] = useState<string>("");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [contactsToPreview, setContactsToPreview] = useState<DistributionContactInsert[]>([]);
  const [importSource, setImportSource] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    
    if (!fullName && (firstName || lastName)) {
      fullName = [firstName, lastName].filter(Boolean).join(" ");
    }

    const email = getValue(mappings.email).toLowerCase();
    
    if (!email || !email.includes("@")) return null;
    if (!fullName) fullName = "Unknown";

    const sectorsValue = getValue(mappings.sectors);
    const sectorNames = sectors.map(s => s.name.toLowerCase());
    const parsedSectors = sectorsValue 
      ? sectorsValue.split(/[,;]/).map(s => s.trim()).filter(s => sectorNames.includes(s.toLowerCase()))
      : [];

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
          
          const range = XLSX.utils.decode_range(firstSheet['!ref'] || 'A1');
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

          const headers = Object.keys(jsonData[0]);

          const nonEmptyRows = jsonData.filter(row => {
            const values = Object.values(row);
            const filledCells = values.filter(val => val && val.toString().trim() !== '').length;
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

      const matchedFormat = findMatchingFormat(headers);
      
      if (matchedFormat) {
        toast.success(`Recognized format: "${matchedFormat.format_name}". Processing ${rows.length} contacts...`);
        await processWithMappings(rows, headers, matchedFormat.column_mappings);
      } else {
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
    setIsProcessing(true);

    try {
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

      // Show preview dialog instead of importing directly
      setContactsToPreview(contacts);
      setImportSource(selectedFile?.name || "file");
      setParseStep("preview");
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("Processing failed");
      setParseStep("training");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrainingSave = async (formatName: string, mappings: ContactColumnMappings) => {
    const signature = createHeaderSignature(parsedHeaders);
    await saveFormat.mutateAsync({
      format_name: formatName,
      column_mappings: mappings,
      header_signature: signature,
      sample_headers: parsedHeaders,
    });

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
      if (defaultOwner) {
        await ensureOwner.mutateAsync(defaultOwner);
      }

      const contacts = parsePastedText(pastedText, defaultOwner);
      if (contacts.length === 0) {
        toast.error("No valid contacts found.");
        return;
      }

      // Show preview dialog instead of importing directly
      setContactsToPreview(contacts);
      setImportSource("pasted text");
      setParseStep("preview");
    } catch (error) {
      toast.error("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBusinessCardUpload = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    try {
      if (defaultOwner) {
        await ensureOwner.mutateAsync(defaultOwner);
      }

      // Read file as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix to get just the base64
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedImage);
      });

      const { data, error } = await supabase.functions.invoke("parse-business-card", {
        body: { 
          imageBase64: base64,
          mimeType: selectedImage.type 
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Failed to parse business card");

      const extractedContacts = data.contacts || [];
      const totalDetected = data.total_cards_detected || extractedContacts.length;
      
      if (extractedContacts.length === 0) {
        toast.error("No business cards detected in the image");
        return;
      }

      // Convert extracted contacts to DistributionContactInsert format
      const contactInserts: DistributionContactInsert[] = extractedContacts
        .filter((contact: { full_name?: string; email?: string }) => 
          contact.full_name && contact.email && contact.email.includes("@")
        )
        .map((contact: { 
          full_name: string; 
          email: string; 
          company?: string; 
          job_title?: string; 
          country?: string; 
          city?: string; 
          linkedin_url?: string; 
          phone?: string 
        }) => ({
          full_name: contact.full_name || "Unknown",
          email: (contact.email || "").toLowerCase(),
          company: contact.company || null,
          job_title: contact.job_title || null,
          country: contact.country || null,
          city: contact.city || null,
          gender: "unknown" as const,
          sectors: [],
          sectors_ai_assigned: false,
          linkedin_url: contact.linkedin_url || null,
          notes: contact.phone ? `Phone: ${contact.phone}` : null,
          relationship_owner: defaultOwner || null,
          do_not_contact: false,
          provenance: `Business card: ${selectedImage.name}`,
        }));

      if (contactInserts.length === 0) {
        toast.error("Could not extract valid email addresses from the business card(s)");
        return;
      }

      // Show info about extraction results
      if (totalDetected > contactInserts.length) {
        toast.info(`Extracted ${contactInserts.length} of ${totalDetected} detected cards (some missing email addresses)`);
      } else if (contactInserts.length > 1) {
        toast.success(`Found ${contactInserts.length} business cards in the image`);
      }

      // Show preview dialog
      setContactsToPreview(contactInserts);
      setImportSource(`business card${contactInserts.length > 1 ? 's' : ''}: ${selectedImage.name}`);
      setParseStep("preview");

    } catch (error) {
      console.error("Business card parsing error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse business card");
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      const isValidType = validTypes.includes(file.type.toLowerCase()) || 
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif');
      
      if (isValidType) {
        setSelectedImage(file);
      } else {
        toast.error("Please upload an image file (JPG, PNG, WebP, or HEIC)");
      }
    }
  };

  const resetDialog = () => {
    setPastedText("");
    setSelectedFile(null);
    setSelectedImage(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    setDefaultOwner("");
    setOwnerSearch("");
    setContactsToPreview([]);
    setImportSource("");
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const OwnerSelector = () => (
    <div>
      <Label className="flex items-center gap-2">
        <User className="h-4 w-4" />
        Contact Owner <span className="text-destructive">*</span>
      </Label>
      <p className="text-sm text-muted-foreground mb-2">
        Required. Assign a relationship owner to imported contacts.
      </p>
      <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-between",
              !defaultOwner && "border-destructive/50"
            )}
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
      {!defaultOwner && (
        <p className="text-xs text-destructive mt-1">Contact owner is required</p>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open && parseStep === "select"} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="paste" className="gap-2">
                <FileText className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Business Card
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
              <OwnerSelector />
            </TabsContent>

            <TabsContent value="file" className="space-y-4 mt-4">
              <div>
                <Label>Upload Excel or CSV file</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload your file and train the system to recognize column mappings.
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
              <OwnerSelector />
            </TabsContent>

            <TabsContent value="card" className="space-y-4 mt-4">
              <div>
                <Label>Upload Business Card Photo</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a photo of a business card. AI will extract contact details automatically.
                </p>
                
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {selectedImage ? (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                    <Camera className="h-8 w-8 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedImage.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedImage.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearImage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors text-center"
                  >
                    <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload business card</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports JPG, PNG, WebP, HEIC
                    </p>
                  </button>
                )}
              </div>
              <OwnerSelector />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }}>
              Cancel
            </Button>
            {activeTab === "paste" && (
              <Button onClick={handlePasteImport} disabled={isProcessing || !pastedText.trim() || !defaultOwner}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            )}
            {activeTab === "file" && (
              <Button onClick={handleFileAnalyse} disabled={isProcessing || !selectedFile || !defaultOwner}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Analyse File
              </Button>
            )}
            {activeTab === "card" && (
              <Button onClick={handleBusinessCardUpload} disabled={isProcessing || !selectedImage || !defaultOwner}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Extract Contact
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Dialog */}
      <ContactFormatTrainingDialog
        isOpen={parseStep === "training"}
        onClose={() => {
          setParseStep("select");
        }}
        onSave={handleTrainingSave}
        headers={parsedHeaders}
        sampleRows={parsedData}
      />

      {/* Preview Dialog */}
      <ImportPreviewDialog
        open={parseStep === "preview"}
        onOpenChange={(o) => {
          if (!o) {
            setParseStep("select");
            setContactsToPreview([]);
          }
        }}
        contacts={contactsToPreview}
        source={importSource}
        onComplete={() => {
          resetDialog();
          onOpenChange(false);
        }}
      />
    </>
  );
}
