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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBulkCreateDistributionContacts, type DistributionContactInsert } from "@/lib/hooks/useDistributionContacts";
import { useLogDistributionActivity } from "@/lib/hooks/useDistributionActivityLog";
import { Upload, FileText, Loader2, FileSpreadsheet, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  full_name?: string;
  name?: string;
  email?: string;
  company?: string;
  organisation?: string;
  job_title?: string;
  title?: string;
  role?: string;
  position?: string;
  country?: string;
  city?: string;
  gender?: string;
  linkedin?: string;
  linkedin_url?: string;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [activeTab, setActiveTab] = useState("paste");
  const [pastedText, setPastedText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = useBulkCreateDistributionContacts();
  const logActivity = useLogDistributionActivity();

  const normaliseGender = (value: string | undefined): 'male' | 'female' | 'unknown' => {
    if (!value) return 'unknown';
    const lower = value.toLowerCase().trim();
    if (lower === 'm' || lower === 'male' || lower === 'man') return 'male';
    if (lower === 'f' || lower === 'female' || lower === 'woman') return 'female';
    return 'unknown';
  };

  const parseRowToContact = (row: ParsedRow, provenance: string): DistributionContactInsert | null => {
    const name = row.full_name || row.name || '';
    const email = row.email || '';
    
    if (!email || !email.includes('@')) return null;

    return {
      full_name: name || 'Unknown',
      email: email.trim().toLowerCase(),
      company: row.company || row.organisation || null,
      job_title: row.job_title || row.title || row.role || row.position || null,
      country: row.country || null,
      city: row.city || null,
      gender: normaliseGender(row.gender),
      sectors: [],
      sectors_ai_assigned: false,
      linkedin_url: row.linkedin || row.linkedin_url || null,
      notes: null,
      relationship_owner: null,
      do_not_contact: false,
      provenance,
    };
  };

  const parseExcelFile = async (file: File): Promise<DistributionContactInsert[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(firstSheet, { 
            defval: '',
            raw: false,
          });

          // Normalise header names (handle various column name formats)
          const normalised = jsonData.map(row => {
            const normRow: ParsedRow = {};
            Object.entries(row).forEach(([key, value]) => {
              const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_');
              if (lowerKey.includes('name') && !lowerKey.includes('company')) {
                normRow.full_name = normRow.full_name || String(value);
              } else if (lowerKey.includes('email')) {
                normRow.email = String(value);
              } else if (lowerKey.includes('company') || lowerKey.includes('organisation') || lowerKey.includes('organization') || lowerKey.includes('firm')) {
                normRow.company = String(value);
              } else if (lowerKey.includes('title') || lowerKey.includes('role') || lowerKey.includes('position') || lowerKey.includes('job')) {
                normRow.job_title = String(value);
              } else if (lowerKey.includes('country')) {
                normRow.country = String(value);
              } else if (lowerKey.includes('city') || lowerKey.includes('location')) {
                normRow.city = String(value);
              } else if (lowerKey.includes('gender') || lowerKey.includes('sex')) {
                normRow.gender = String(value);
              } else if (lowerKey.includes('linkedin')) {
                normRow.linkedin_url = String(value);
              }
            });
            return normRow;
          });

          const contacts = normalised
            .map(row => parseRowToContact(row, `File import: ${file.name}`))
            .filter((c): c is DistributionContactInsert => c !== null);

          resolve(contacts);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const parsePastedText = (text: string): DistributionContactInsert[] => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    
    // Check if first line looks like headers
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
        relationship_owner: null,
        do_not_contact: false,
        provenance: "Pasted import",
      };
    }).filter(c => c.email);
  };

  const handleImport = async () => {
    setIsProcessing(true);
    try {
      let contacts: DistributionContactInsert[] = [];

      if (activeTab === "file" && selectedFile) {
        contacts = await parseExcelFile(selectedFile);
      } else if (activeTab === "paste" && pastedText.trim()) {
        contacts = parsePastedText(pastedText);
      }

      if (contacts.length === 0) {
        toast.error("No valid contacts found. Ensure each row has an email address.");
        return;
      }

      await bulkCreate.mutateAsync(contacts);
      await logActivity.mutateAsync({
        activity_type: "import_completed",
        description: `Imported ${contacts.length} contacts from ${activeTab === "file" ? selectedFile?.name : "pasted text"}`,
        metadata: { count: contacts.length, source: activeTab },
      });

      setPastedText("");
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed. Check the file format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (validTypes.includes(file.type) || hasValidExtension) {
        setSelectedFile(file);
      } else {
        toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
      }
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canImport = activeTab === "file" ? !!selectedFile : !!pastedText.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>

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
                rows={10}
                placeholder="John Smith, john@example.com&#10;Jane Doe, jane@example.com"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-4">
            <div>
              <Label>Upload Excel or CSV file</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Columns like Name, Email, Company, Job Title, Country, City, Gender will be automatically detected.
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
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
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
                  className="w-full p-8 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors text-center"
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to select file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports .xlsx, .xls, .csv
                  </p>
                </button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isProcessing || !canImport}>
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
