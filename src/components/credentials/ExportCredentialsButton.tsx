import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { type DealCredential } from '@/lib/hooks/useCredentials';

interface ExportCredentialsButtonProps {
  credentials: DealCredential[];
}

type GroupBy = 'deal_type' | 'sector' | 'year' | 'jurisdiction';
type ConfidentialityMode = 'confidential' | 'public';

function groupCredentials(credentials: DealCredential[], groupBy: GroupBy): Record<string, DealCredential[]> {
  const groups: Record<string, DealCredential[]> = {};
  for (const cred of credentials) {
    let keys: string[] = [];
    if (groupBy === 'deal_type') keys = [cred.deal_type || 'Other'];
    else if (groupBy === 'sector') keys = [cred.sector || 'Other'];
    else if (groupBy === 'year') keys = [cred.year_completed?.toString() || 'Unknown'];
    else if (groupBy === 'jurisdiction') keys = cred.jurisdictions?.length ? cred.jurisdictions : ['Other'];

    for (const key of keys) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(cred);
    }
  }

  const sorted = Object.entries(groups).sort((a, b) => {
    if (groupBy === 'year') return b[0].localeCompare(a[0]);
    return a[0].localeCompare(b[0]);
  });
  return Object.fromEntries(sorted);
}

function getClientName(cred: DealCredential, mode: ConfidentialityMode): string {
  if (mode === 'confidential') return cred.client_name;
  return cred.client_public_name || 'Confidential client';
}

function generateWordHtml(
  credentials: DealCredential[],
  groupBy: GroupBy,
  mode: ConfidentialityMode,
): string {
  const now = format(new Date(), 'dd MMMM yyyy');
  const grouped = groupCredentials(credentials, groupBy);
  const groupLabel = groupBy === 'deal_type' ? 'Deal Type' : groupBy === 'sector' ? 'Sector' : groupBy === 'year' ? 'Year' : 'Jurisdiction';

  const sectionsHtml = Object.entries(grouped).map(([group, creds]) => {
    const credCards = creds.map(cred => {
      const clientName = getClientName(cred, mode);
      const jurisdictions = cred.jurisdictions?.join(', ') || '';
      const value = cred.deal_value
        ? `${cred.deal_currency || 'USD'} ${cred.deal_value.toLocaleString()}`
        : '';
      const institutions = cred.has_institutional_involvement && cred.institutions?.length
        ? cred.institutions.join(', ')
        : '';
      const practiceAreas = cred.practice_areas?.join(', ') || '';

      const metaParts: string[] = [];
      if (jurisdictions) metaParts.push(`<strong>Jurisdiction:</strong> ${jurisdictions}`);
      if (value) metaParts.push(`<strong>Value:</strong> ${value}`);
      if (cred.role_played) metaParts.push(`<strong>Role:</strong> ${cred.role_played}`);
      if (cred.lead_partner) metaParts.push(`<strong>Lead Partner:</strong> ${cred.lead_partner}`);
      if (practiceAreas) metaParts.push(`<strong>Practice Areas:</strong> ${practiceAreas}`);
      if (institutions) metaParts.push(`<strong>Institutions:</strong> ${institutions}`);
      if (cred.year_completed) metaParts.push(`<strong>Year:</strong> ${cred.year_completed}`);

      const statusColor = cred.status === 'Completed' ? '#059669' : cred.status === 'Active' ? '#2563eb' : '#6b7280';

      return `
        <div style="margin-bottom: 16px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h3 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 12pt; color: #111827; margin: 0 0 4px 0; font-weight: 600;">${cred.deal_name}</h3>
            <span style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: ${statusColor}; font-weight: 500;">${cred.status}</span>
          </div>
          <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #374151; margin: 0 0 6px 0; font-weight: 500;">${clientName}</p>
          ${cred.description ? `<p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #4b5563; margin: 0 0 8px 0; font-style: italic;">${cred.description}</p>` : ''}
          <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #6b7280;">
            ${metaParts.join(' &nbsp;|&nbsp; ')}
          </div>
        </div>
      `;
    }).join('');

    return `
      <h2 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 16pt; color: #1e40af; border-bottom: 2px solid #dbeafe; padding-bottom: 6px; margin: 24px 0 12px 0;">${group} <span style="font-size: 11pt; color: #6b7280; font-weight: normal;">(${creds.length} deal${creds.length !== 1 ? 's' : ''})</span></h2>
      ${credCards}
    `;
  }).join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><style>
      @page Section1 { size: A4 portrait; margin: 2.5cm; }
      div.Section1 { page: Section1; }
      body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
    </style></head>
    <body>
    <div class="Section1">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 22pt; color: #111827; margin: 0;">Deal Credentials</h1>
        <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #6b7280; margin: 8px 0 4px 0;">
          ${credentials.length} deal${credentials.length !== 1 ? 's' : ''} &bull; Grouped by ${groupLabel} &bull; ${mode === 'public' ? 'Public (anonymised)' : 'Confidential'}
        </p>
        <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #9ca3af;">${now}</p>
      </div>
      ${sectionsHtml}
      <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #9ca3af; text-align: center;">
          ${mode === 'confidential' ? 'CONFIDENTIAL — This document contains client-privileged information. Do not distribute externally.' : 'This document has been prepared for external use. Client names have been anonymised where applicable.'}
        </p>
      </div>
    </div>
    </body></html>
  `;
}

export function ExportCredentialsButton({ credentials }: ExportCredentialsButtonProps) {
  const [open, setOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('deal_type');
  const [mode, setMode] = useState<ConfidentialityMode>('confidential');

  const handleExport = () => {
    if (credentials.length === 0) return;
    const html = generateWordHtml(credentials, groupBy, mode);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Deal Credentials - ${mode === 'public' ? 'Public' : 'Confidential'} - ${format(new Date(), 'yyyy-MM-dd')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={credentials.length === 0}>
        <FileDown className="h-4 w-4 mr-1" /> Export
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Credentials to Word</DialogTitle>
            <DialogDescription>
              Export {credentials.length} credential{credentials.length !== 1 ? 's' : ''} as a formatted Word document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Confidentiality</Label>
              <RadioGroup value={mode} onValueChange={v => setMode(v as ConfidentialityMode)}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="confidential" id="conf" className="mt-1" />
                  <Label htmlFor="conf" className="font-normal cursor-pointer">
                    <span className="font-medium">Confidential</span>
                    <span className="block text-xs text-muted-foreground">Real client names, full details. For internal use only.</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="public" id="pub" className="mt-1" />
                  <Label htmlFor="pub" className="font-normal cursor-pointer">
                    <span className="font-medium">Public / Anonymised</span>
                    <span className="block text-xs text-muted-foreground">Uses public client names where set, otherwise "Confidential client".</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Group by</Label>
              <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deal_type">Deal Type</SelectItem>
                  <SelectItem value="sector">Sector</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="jurisdiction">Jurisdiction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-1" /> Download .doc
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
