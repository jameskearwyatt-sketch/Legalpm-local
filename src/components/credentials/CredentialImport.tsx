import { useState, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { type CreateCredentialInput, generateDescription } from '@/lib/hooks/useCredentials';

interface CredentialImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: CreateCredentialInput[]) => void;
  isImporting: boolean;
}

interface ParsedRow {
  deal_name: string;
  client_name: string;
  deal_type?: string;
  sector?: string;
  jurisdictions?: string[];
  deal_value?: number;
  deal_currency?: string;
  role_played?: string;
  lead_partner?: string;
  year_completed?: number;
  practice_areas?: string[];
  description?: string;
  selected: boolean;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  'deal name': 'deal_name',
  'deal': 'deal_name',
  'matter': 'deal_name',
  'matter name': 'deal_name',
  'project': 'deal_name',
  'project name': 'deal_name',
  'transaction': 'deal_name',
  'client': 'client_name',
  'client name': 'client_name',
  'type': 'deal_type',
  'deal type': 'deal_type',
  'transaction type': 'deal_type',
  'sector': 'sector',
  'industry': 'sector',
  'jurisdiction': 'jurisdictions',
  'jurisdictions': 'jurisdictions',
  'country': 'jurisdictions',
  'countries': 'jurisdictions',
  'value': 'deal_value',
  'deal value': 'deal_value',
  'amount': 'deal_value',
  'currency': 'deal_currency',
  'deal currency': 'deal_currency',
  'role': 'role_played',
  'role played': 'role_played',
  'partner': 'lead_partner',
  'lead partner': 'lead_partner',
  'year': 'year_completed',
  'year completed': 'year_completed',
  'completion year': 'year_completed',
  'practice area': 'practice_areas',
  'practice areas': 'practice_areas',
  'description': 'description',
};

function normalizeColumnName(name: string): keyof ParsedRow | null {
  const lower = name.toLowerCase().trim();
  return COLUMN_MAP[lower] || null;
}

function parseExcelRow(raw: Record<string, unknown>, colMap: Record<string, keyof ParsedRow>): ParsedRow | null {
  const row: Partial<ParsedRow> = {};
  for (const [col, field] of Object.entries(colMap)) {
    const val = raw[col];
    if (val === undefined || val === null || val === '') continue;
    const strVal = String(val).trim();
    if (field === 'deal_value') {
      const num = parseFloat(strVal.replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) row.deal_value = num;
    } else if (field === 'year_completed') {
      const num = parseInt(strVal);
      if (!isNaN(num) && num > 1900 && num < 2100) row.year_completed = num;
    } else if (field === 'jurisdictions' || field === 'practice_areas') {
      row[field] = strVal.split(/[,;/]/).map(s => s.trim()).filter(Boolean);
    } else {
      (row as Record<string, unknown>)[field] = strVal;
    }
  }
  if (!row.deal_name || !row.client_name) return null;
  return { ...row, deal_name: row.deal_name!, client_name: row.client_name!, selected: true };
}

function parseWordText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let current: Partial<ParsedRow> | null = null;
  for (const line of lines) {
    const bulletMatch = line.match(/^[-•·▪►]\s+(.+)/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)/);
    const content = bulletMatch?.[1] || numberedMatch?.[1] || null;

    if (content) {
      if (current && current.deal_name) {
        rows.push({ ...current, deal_name: current.deal_name!, client_name: current.client_name || 'Unknown', selected: true } as ParsedRow);
      }
      current = {};

      const clientMatch = content.match(/^(?:Advised|Acting for|Represented)\s+(.+?)\s+(?:on|in|regarding)\s+(.+)/i);
      if (clientMatch) {
        current.client_name = clientMatch[1].replace(/[.,]+$/, '');
        current.deal_name = clientMatch[2].replace(/[.,]+$/, '');
      } else {
        const dashSplit = content.split(/\s*[–—-]\s*/);
        if (dashSplit.length >= 2) {
          current.client_name = dashSplit[0];
          current.deal_name = dashSplit.slice(1).join(' - ');
        } else {
          current.deal_name = content;
        }
      }

      const yearMatch = content.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) current.year_completed = parseInt(yearMatch[0]);

      const valueMatch = content.match(/(?:USD|EUR|GBP|£|\$|€)\s*([\d,.]+)\s*(?:million|m|bn|billion)?/i);
      if (valueMatch) {
        let val = parseFloat(valueMatch[1].replace(/,/g, ''));
        if (/million|m\b/i.test(content)) val *= 1_000_000;
        if (/billion|bn/i.test(content)) val *= 1_000_000_000;
        current.deal_value = val;
        const currMatch = content.match(/(USD|EUR|GBP)/i);
        if (currMatch) current.deal_currency = currMatch[1].toUpperCase();
      }
    } else if (current && !content) {
      if (!current.description) {
        current.description = line;
      } else {
        current.description += ' ' + line;
      }
    }
  }
  if (current && current.deal_name) {
    rows.push({ ...current, deal_name: current.deal_name!, client_name: current.client_name || 'Unknown', selected: true } as ParsedRow);
  }

  return rows;
}

export function CredentialImport({ open, onOpenChange, onImport, isImporting }: CredentialImportProps) {
  const [tab, setTab] = useState<string>('excel');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setParsedRows([]);
    setFileName('');
    setParseError('');
  };

  const handleExcelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rawRows.length === 0) {
        setParseError('No data found in spreadsheet.');
        return;
      }

      const headers = Object.keys(rawRows[0]);
      const colMap: Record<string, keyof ParsedRow> = {};
      for (const h of headers) {
        const mapped = normalizeColumnName(h);
        if (mapped) colMap[h] = mapped;
      }

      if (!colMap || !Object.values(colMap).includes('deal_name')) {
        setParseError('Could not find a "Deal Name" or "Matter" column. Please ensure your spreadsheet has identifiable column headers.');
        return;
      }

      const rows = rawRows.map(r => parseExcelRow(r, colMap)).filter((r): r is ParsedRow => r !== null);
      if (rows.length === 0) {
        setParseError('No valid rows found. Each row needs at least a deal name and client name.');
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      setParseError('Failed to parse file. Please check the format.');
    }

    e.target.value = '';
  }, []);

  const handleWordUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');

    try {
      const text = await file.text();
      const rows = parseWordText(text);
      if (rows.length === 0) {
        setParseError('Could not extract any deal entries from this document. Try bullet-point or numbered list format.');
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      setParseError('Failed to read file.');
    }

    e.target.value = '';
  }, []);

  const toggleRow = (idx: number) => {
    setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = (selected: boolean) => {
    setParsedRows(prev => prev.map(r => ({ ...r, selected })));
  };

  const handleImport = () => {
    const selected = parsedRows.filter(r => r.selected);
    if (selected.length === 0) {
      toast.error('Select at least one row to import');
      return;
    }

    const inputs: CreateCredentialInput[] = selected.map(r => {
      const input: CreateCredentialInput = {
        deal_name: r.deal_name,
        client_name: r.client_name,
        deal_type: r.deal_type || null,
        sector: r.sector || null,
        jurisdictions: r.jurisdictions?.length ? r.jurisdictions : null,
        deal_value: r.deal_value || null,
        deal_currency: r.deal_currency || null,
        role_played: r.role_played || null,
        lead_partner: r.lead_partner || null,
        year_completed: r.year_completed || null,
        practice_areas: r.practice_areas?.length ? r.practice_areas : null,
        status: 'Completed',
      };
      input.description = r.description || generateDescription(input as Partial<CreateCredentialInput>);
      return input;
    });

    onImport(inputs);
  };

  const selectedCount = parsedRows.filter(r => r.selected).length;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Credentials</DialogTitle>
          <DialogDescription>Upload an Excel spreadsheet or Word document containing your historic deal credentials.</DialogDescription>
        </DialogHeader>

        {parsedRows.length === 0 ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="excel" className="gap-1"><FileSpreadsheet className="h-4 w-4" /> Excel / CSV</TabsTrigger>
              <TabsTrigger value="word" className="gap-1"><FileText className="h-4 w-4" /> Word / Text</TabsTrigger>
            </TabsList>
            <TabsContent value="excel" className="space-y-4 pt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload an Excel file with columns like: Deal Name, Client, Type, Sector, Jurisdiction, Value, Year
                </p>
                <label>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
                  <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" /> Choose File</span></Button>
                </label>
              </div>
            </TabsContent>
            <TabsContent value="word" className="space-y-4 pt-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload a text or Word file with bullet-point or numbered deal entries.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Format: "Advised [Client] on [Deal description]" or "Client — Deal description"
                </p>
                <label>
                  <input type="file" accept=".txt,.doc,.docx" onChange={handleWordUpload} className="hidden" />
                  <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-1" /> Choose File</span></Button>
                </label>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {parsedRows.length} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleAll(true)}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleAll(false)}>Deselect All</Button>
                <Button variant="outline" size="sm" onClick={reset}>Upload Different File</Button>
              </div>
            </div>
            <ScrollArea className="max-h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]" />
                    <TableHead>Deal Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Jurisdiction</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={idx} className={row.selected ? '' : 'opacity-50'} onClick={() => toggleRow(idx)}>
                      <TableCell>
                        {row.selected ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{row.deal_name}</TableCell>
                      <TableCell className="text-sm">{row.client_name}</TableCell>
                      <TableCell className="text-sm">{row.deal_type || '—'}</TableCell>
                      <TableCell className="text-sm">{row.jurisdictions?.join(', ') || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {row.deal_value ? `${row.deal_currency || 'USD'} ${row.deal_value.toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{row.year_completed || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {parseError && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle className="h-4 w-4" /> {parseError}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          {parsedRows.length > 0 && (
            <Button onClick={handleImport} disabled={isImporting || selectedCount === 0}>
              {isImporting ? 'Importing...' : `Import ${selectedCount} Credential${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
