import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { useBulkCreateBMInternalContacts, type BMInternalContactExpertise } from "@/lib/hooks/useBMInternalContacts";

interface BMContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Parse the Excel structure based on the known format
function parseExcelToContacts(workbook: XLSX.WorkBook): {
  first_name: string;
  surname: string;
  title: string | null;
  region: string | null;
  office: string | null;
  practice_group: string | null;
  email: string | null;
  expertise: BMInternalContactExpertise;
}[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  // Find the header row (row with Name, Surname, Title, etc.)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (row && row[0] === 'Name' && row[1] === 'Surname') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Could not find header row. Expected "Name" and "Surname" columns.');
  }

  const headers = data[headerRowIndex];
  const contacts: ReturnType<typeof parseExcelToContacts> = [];

  // Process data rows (starting after header)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0] || !row[1]) continue; // Skip empty rows

    const firstName = String(row[0] || '').trim();
    const surname = String(row[1] || '').trim();
    
    if (!firstName || !surname) continue;

    // Basic info columns
    const title = row[2] ? String(row[2]).trim() : null;
    const region = row[3] ? String(row[3]).trim() : null;
    const office = row[4] ? String(row[4]).trim() : null;
    const practiceGroup = row[5] ? String(row[5]).trim() : null;

    // Parse expertise columns
    // The Excel has a specific structure with expertise columns starting at index 6
    // We need to map Y/y/x/X to true, N/n/empty to false
    const parseExpertiseValue = (val: any): boolean => {
      if (!val) return false;
      const str = String(val).toLowerCase().trim();
      return str === 'y' || str === 'x';
    };

    // Project Development columns (indices 6-43 approximately)
    const projectDevelopment: Record<string, boolean> = {};
    const projectDevCols = [
      { index: 6, key: 'project_development_general' },
      { index: 7, key: 'offshore_wind' },
      { index: 8, key: 'onshore_wind' },
      { index: 9, key: 'solar' },
      { index: 10, key: 'hydro' },
      { index: 11, key: 'geothermal' },
      { index: 12, key: 'corporate_ppa' },
      { index: 13, key: 'battery_storage' },
      { index: 14, key: 'power_conventional' },
      { index: 15, key: 'nuclear' },
      { index: 16, key: 'waste_to_power' },
      { index: 17, key: 'hydrogen' },
      { index: 18, key: 'ccus' },
      { index: 19, key: 'sustainable_fuels' },
      { index: 20, key: 'metals_mining' },
      { index: 21, key: 'upstream_og' },
      { index: 22, key: 'midstream_og' },
      { index: 23, key: 'downstream_og' },
      { index: 24, key: 'lng_specialist' },
      { index: 25, key: 'shipping_og' },
      { index: 26, key: 'fsru' },
      { index: 27, key: 'petchems' },
      { index: 28, key: 'airports' },
      { index: 29, key: 'ports_terminals' },
      { index: 30, key: 'roads_bridges_tunnels' },
      { index: 31, key: 'datacenters' },
      { index: 32, key: 'dt_other' },
      { index: 33, key: 'power_transmission_grids' },
      { index: 34, key: 'rail' },
      { index: 35, key: 'water_waste_management' },
      { index: 36, key: 'healthcare' },
      { index: 37, key: 'other_social_infra' },
      { index: 38, key: 'carbon_transactions' },
      { index: 39, key: 'carbon_infra' },
      { index: 40, key: 'carbon_regulatory' },
      { index: 41, key: 'construction_specialist' },
      { index: 42, key: 'regulatory_specialist' },
      { index: 43, key: 'any_shipping_work' },
    ];

    for (const col of projectDevCols) {
      if (parseExpertiseValue(row[col.index])) {
        projectDevelopment[col.key] = true;
      }
    }

    // M&A columns (indices 44-69 approximately)
    const ma: Record<string, boolean> = {};
    const maCols = [
      { index: 44, key: 'ma_general' },
      { index: 45, key: 'offshore_wind' },
      { index: 46, key: 'onshore_wind' },
      { index: 47, key: 'solar' },
      { index: 48, key: 'hydro' },
      { index: 49, key: 'geothermal' },
      { index: 50, key: 'battery_storage' },
      { index: 51, key: 'power_conventional' },
      { index: 52, key: 'nuclear' },
      { index: 53, key: 'waste_to_power' },
      { index: 54, key: 'hydrogen' },
      { index: 55, key: 'ccus' },
      { index: 56, key: 'sustainable_fuels' },
      { index: 57, key: 'metals_mining' },
      { index: 58, key: 'oil_gas' },
      { index: 59, key: 'petchems' },
      { index: 60, key: 'airports' },
      { index: 61, key: 'ports_terminals' },
      { index: 62, key: 'roads_bridges_tunnels' },
      { index: 63, key: 'datacenters' },
      { index: 64, key: 'dt_other' },
      { index: 65, key: 'power_transmission_grids' },
      { index: 66, key: 'rail' },
      { index: 67, key: 'water_waste_management' },
      { index: 68, key: 'healthcare' },
      { index: 69, key: 'other_social_infra' },
    ];

    for (const col of maCols) {
      if (parseExpertiseValue(row[col.index])) {
        ma[col.key] = true;
      }
    }

    // Project Finance columns (indices 70-81 approximately)
    const projectFinance: Record<string, boolean> = {};
    const pfCols = [
      { index: 70, key: 'project_finance_general' },
      { index: 71, key: 'renewables' },
      { index: 72, key: 'battery_storage' },
      { index: 73, key: 'conventional' },
      { index: 74, key: 'hydrogen' },
      { index: 75, key: 'ccus' },
      { index: 76, key: 'sustainable_fuels' },
      { index: 77, key: 'metals_mining' },
      { index: 78, key: 'oil_gas' },
      { index: 79, key: 'petchems' },
      { index: 80, key: 'infrastructure' },
      { index: 81, key: 'ppp' },
    ];

    for (const col of pfCols) {
      if (parseExpertiseValue(row[col.index])) {
        projectFinance[col.key] = true;
      }
    }

    contacts.push({
      first_name: firstName,
      surname: surname,
      title,
      region,
      office,
      practice_group: practiceGroup,
      email: null, // Email not in the Excel
      expertise: {
        project_development: projectDevelopment,
        ma: ma,
        project_finance: projectFinance,
      } as BMInternalContactExpertise,
    });
  }

  return contacts;
}

export function BMContactImportDialog({ open, onOpenChange }: BMContactImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedCount, setParsedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreate = useBulkCreateBMInternalContacts();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setParsedCount(0);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellFormula: false });
      
      const contacts = parseExcelToContacts(workbook);
      
      if (contacts.length === 0) {
        throw new Error('No valid contacts found in the file');
      }

      setParsedCount(contacts.length);

      await bulkCreate.mutateAsync(contacts);
      
      onOpenChange(false);
      setFile(null);
      setParsedCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setParsing(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setError(null);
    setParsedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetDialog();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import BM Contacts</DialogTitle>
          <DialogDescription>
            Upload the EMI Expertise Mapping Excel file to import contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="file">Excel File</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
            </div>
          </div>

          {/* File info */}
          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}

          {/* Progress */}
          {parsing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {parsedCount > 0 ? `Importing ${parsedCount} contacts...` : 'Parsing file...'}
                </span>
              </div>
              <Progress value={parsedCount > 0 ? 75 : 25} />
            </div>
          )}

          {/* Success */}
          {parsedCount > 0 && !parsing && !error && (
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Ready to import {parsedCount} contacts</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || parsing || bulkCreate.isPending}
          >
            {parsing || bulkCreate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
