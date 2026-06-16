import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type DistributionContactInsert } from "@/lib/hooks/useDistributionContacts";
import { useDistributionSectors } from "@/lib/hooks/useDistributionSectors";
import { useDistributionRelationshipOwners, useEnsureRelationshipOwner } from "@/lib/hooks/useDistributionRelationshipOwners";
import { useContactImportFormats, ContactColumnMappings } from "@/lib/hooks/useContactImportFormats";
import { ContactFormatTrainingDialog } from "./ContactFormatTrainingDialog";
import { ImportPreviewDialog } from "./ImportPreviewDialog";
import { OwnerSelector } from "./OwnerSelector";
import { Upload, Loader2, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: (importedIds: string[]) => void;
}

export function ContactImportDialog({ open, onOpenChange, onImportComplete }: ContactImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parseStep, setParseStep] = useState<"select" | "training" | "preview">("select");
  const [defaultOwner, setDefaultOwner] = useState<string>("");
  const [contactsToPreview, setContactsToPreview] = useState<DistributionContactInsert[]>([]);
  const [importSource, setImportSource] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sectors = [] } = useDistributionSectors();
  const { data: relationshipOwners = [] } = useDistributionRelationshipOwners();
  const ensureOwner = useEnsureRelationshipOwner();
  const { findMatchingFormat, saveFormat, createHeaderSignature } = useContactImportFormats();

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
      // Always use "FirstName Surname" format for consistency
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

  // Auto-detect essential fields from headers using common patterns
  const autoDetectMappings = (headers: string[]): { mappings: ContactColumnMappings; hasMissingEssentials: boolean } => {
    const mappings: ContactColumnMappings = {};
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    // Email detection patterns
    const emailPatterns = ['email', 'e-mail', 'email address', 'emailaddress', 'mail'];
    const emailIdx = lowerHeaders.findIndex(h => emailPatterns.some(p => h.includes(p)));
    if (emailIdx !== -1) mappings.email = emailIdx;

    // Full name detection patterns
    const fullNamePatterns = ['full name', 'fullname', 'name', 'contact name', 'contact'];
    const fullNameIdx = lowerHeaders.findIndex(h => fullNamePatterns.some(p => h === p || h.includes(p)));
    if (fullNameIdx !== -1 && fullNameIdx !== emailIdx) mappings.full_name = fullNameIdx;

    // First name detection
    const firstNamePatterns = ['first name', 'firstname', 'first', 'given name', 'forename'];
    const firstNameIdx = lowerHeaders.findIndex(h => firstNamePatterns.some(p => h === p || h.includes(p)));
    if (firstNameIdx !== -1) mappings.first_name = firstNameIdx;

    // Last name detection
    const lastNamePatterns = ['last name', 'lastname', 'surname', 'family name', 'last'];
    const lastNameIdx = lowerHeaders.findIndex(h => lastNamePatterns.some(p => h === p || h.includes(p)));
    if (lastNameIdx !== -1) mappings.last_name = lastNameIdx;

    // Company detection
    const companyPatterns = ['company', 'organization', 'organisation', 'employer', 'firm', 'company name'];
    const companyIdx = lowerHeaders.findIndex(h => companyPatterns.some(p => h === p || h.includes(p)));
    if (companyIdx !== -1) mappings.company = companyIdx;

    // Job title detection
    const titlePatterns = ['job title', 'title', 'position', 'role', 'designation'];
    const titleIdx = lowerHeaders.findIndex(h => titlePatterns.some(p => h === p || h.includes(p)));
    if (titleIdx !== -1) mappings.job_title = titleIdx;

    // Country detection
    const countryPatterns = ['country', 'location', 'nation'];
    const countryIdx = lowerHeaders.findIndex(h => countryPatterns.some(p => h === p || h.includes(p)));
    if (countryIdx !== -1) mappings.country = countryIdx;

    // City detection
    const cityPatterns = ['city', 'town'];
    const cityIdx = lowerHeaders.findIndex(h => cityPatterns.some(p => h === p || h.includes(p)));
    if (cityIdx !== -1) mappings.city = cityIdx;

    // LinkedIn detection
    const linkedinPatterns = ['linkedin', 'linkedin url', 'linkedin profile'];
    const linkedinIdx = lowerHeaders.findIndex(h => linkedinPatterns.some(p => h === p || h.includes(p)));
    if (linkedinIdx !== -1) mappings.linkedin_url = linkedinIdx;

    // Check if essential fields are present
    const hasEmail = mappings.email !== undefined;
    const hasName = mappings.full_name !== undefined ||
                    (mappings.first_name !== undefined && mappings.last_name !== undefined);

    return { mappings, hasMissingEssentials: !hasEmail || !hasName };
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
        // Try auto-detection
        const { mappings: autoMappings, hasMissingEssentials } = autoDetectMappings(headers);

        if (hasMissingEssentials) {
          // Essential fields not found - prompt for training
          toast.warning(`Could not auto-detect Email or Name columns. Please map the columns manually.`);
          setParseStep("training");
        } else {
          // Auto-detection successful, but still new format - let user verify/save
          toast.info(`Auto-detected ${Object.keys(autoMappings).length} columns. Please verify the mapping.`);
          setParseStep("training");
        }
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
    setSelectedFile(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    setDefaultOwner("");
    setContactsToPreview([]);
    setImportSource("");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParsedData([]);
    setParsedHeaders([]);
    setParseStep("select");
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const ownerSelectorProps = {
    defaultOwner,
    onOwnerChange: setDefaultOwner,
    relationshipOwners: relationshipOwners.map(o => ({ id: o.id, name: o.name })),
  };

  return (
    <>
      <Dialog open={open && parseStep === "select"} onOpenChange={(o) => { if (!o) resetDialog(); onOpenChange(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
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
            <OwnerSelector {...ownerSelectorProps} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button onClick={handleFileAnalyse} disabled={isProcessing || !selectedFile || !defaultOwner}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Analyse File
            </Button>
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
        onComplete={(importedIds) => {
          resetDialog();
          onOpenChange(false);
          onImportComplete?.(importedIds);
        }}
      />
    </>
  );
}
