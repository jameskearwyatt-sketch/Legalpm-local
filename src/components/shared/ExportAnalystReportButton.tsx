/**
 * Shared "Export to Word" button for the 5 analyst report components.
 *
 * Takes a pre-mapped `AnalystReportExport` payload (metadata + positions
 * grouped by category group) and produces a styled `.doc` file using the
 * same HTML-blob-with-msword-mime trick as `ExportMarketCommentaryButton`.
 * That avoids the ~400KB `docx` dependency while still giving attorneys
 * a file that opens natively in Word with proper page breaks, headings,
 * and inline colour-coded badges.
 *
 * Per-analyst divergence (terminology like "Tenant" vs "Offtaker",
 * analyst-specific badges, perspective labels) is resolved by the caller
 * before reaching this component.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type ExportConfidence = 'high' | 'medium' | 'review_required' | null;
export type ExportMarketPosition = 'on_market' | 'off_market' | 'way_off_market' | null;

export interface ExportPosition {
  category: string;
  confidence: ExportConfidence;
  marketPosition: ExportMarketPosition;
  positionSummary: string;
  comparisonPosition?: string | null;
  varianceNotes?: string | null;
  sourceText?: string | null;
}

export interface ExportPositionGroup {
  group: string;
  positions: ExportPosition[];
}

export interface AnalystReportExport {
  analystTitle: string; // e.g. "Cloud Compute Analyst"
  projectName: string;
  analysisTypeLabel: string; // e.g. "vs Knowledge Bank"
  perspectiveLabel: string; // e.g. "Tenant Perspective"
  jurisdiction?: string | null;
  extraBadges?: string[]; // e.g. ["IaaS", "Hybrid Cloud"]
  isAgreed: boolean;
  createdAt: string; // ISO string
  positionsByGroup: ExportPositionGroup[];
}

const CONFIDENCE_STYLE: Record<Exclude<ExportConfidence, null>, { label: string; bg: string; color: string }> = {
  high: { label: 'High', bg: '#dbeafe', color: '#1e40af' },
  medium: { label: 'Medium', bg: '#fef3c7', color: '#92400e' },
  review_required: { label: 'Review', bg: '#fee2e2', color: '#991b1b' },
};

const MARKET_STYLE: Record<Exclude<ExportMarketPosition, null>, { label: string; bg: string; color: string; border: string }> = {
  on_market: { label: 'On Market', bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' },
  off_market: { label: 'Off Market', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  way_off_market: { label: 'Way Off Market', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripMarkers(notes: string | null | undefined): string | null {
  if (!notes) return null;
  return notes
    .replace(/\[(ON MARKET|OFF MARKET|WAY OFF MARKET)\]\s*/gi, '')
    .replace(/\[(BUYER-FRIENDLY|SELLER-FRIENDLY|TENANT-FRIENDLY|PROVIDER-FRIENDLY|OFFTAKER-FRIENDLY|GENERATOR-FRIENDLY|SUPPLIER-FRIENDLY|BALANCED)\]\s*/gi, '')
    .trim() || null;
}

function renderPositionHtml(p: ExportPosition): string {
  const confBadge = p.confidence
    ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9pt; background-color: ${CONFIDENCE_STYLE[p.confidence].bg}; color: ${CONFIDENCE_STYLE[p.confidence].color}; margin-right: 6px;">${CONFIDENCE_STYLE[p.confidence].label}</span>`
    : '';
  const mktBadge = p.marketPosition
    ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9pt; background-color: ${MARKET_STYLE[p.marketPosition].bg}; color: ${MARKET_STYLE[p.marketPosition].color}; border: 1px solid ${MARKET_STYLE[p.marketPosition].border}; margin-right: 6px; font-weight: 600;">${MARKET_STYLE[p.marketPosition].label}</span>`
    : '';
  const sourceBadge = p.sourceText
    ? `<span style="display: inline-block; padding: 2px 6px; font-size: 9pt; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; color: #6b7280; border-radius: 3px;">${escapeHtml(p.sourceText)}</span>`
    : '';

  const summaryLines = p.positionSummary.split('\n').filter(l => l.trim());
  const summaryHtml = summaryLines
    .map(line => `<p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #1f2937; margin: 4px 0; line-height: 1.55;">${escapeHtml(line)}</p>`)
    .join('');

  const comparisonHtml = p.comparisonPosition
    ? `<div style="border-left: 3px solid #c7d2fe; padding: 6px 10px; margin: 8px 0; background-color: #f5f3ff;">
         <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #6b7280; font-weight: 600; margin: 0 0 3px 0; text-transform: uppercase; letter-spacing: 0.4px;">Comparison</p>
         <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #4c1d95; font-style: italic; margin: 0;">${escapeHtml(p.comparisonPosition)}</p>
       </div>`
    : '';

  const cleanedNotes = stripMarkers(p.varianceNotes);
  const notesHtml = cleanedNotes
    ? `<p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #6b7280; margin: 6px 0 0 0; font-style: italic;">${escapeHtml(cleanedNotes)}</p>`
    : '';

  return `
    <div style="page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px; background-color: #ffffff;">
      <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; font-weight: 700; color: #111827; margin: 0 0 8px 0;">${escapeHtml(p.category)}</p>
      <div style="margin-bottom: 8px;">${confBadge}${mktBadge}${sourceBadge}</div>
      ${summaryHtml}
      ${comparisonHtml}
      ${notesHtml}
    </div>`;
}

function generateHtml(payload: AnalystReportExport): string {
  const now = format(new Date(), 'dd MMMM yyyy');
  const analysedAt = format(new Date(payload.createdAt), 'PPp');
  const totalPositions = payload.positionsByGroup.reduce((n, g) => n + g.positions.length, 0);
  const totalGroups = payload.positionsByGroup.filter(g => g.positions.length > 0).length;

  const groupsHtml = payload.positionsByGroup
    .filter(g => g.positions.length > 0)
    .map((g, idx) => `
      <div style="page-break-inside: avoid; margin-top: ${idx === 0 ? '0' : '24px'};">
        <h2 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 15pt; color: #111827; border-bottom: 2px solid #1e40af; padding-bottom: 5px; margin: 0 0 14px 0;">
          ${escapeHtml(g.group)}
          <span style="font-size: 10pt; color: #6b7280; font-weight: normal;">&nbsp;·&nbsp;${g.positions.length} position${g.positions.length !== 1 ? 's' : ''}</span>
        </h2>
        ${g.positions.map(renderPositionHtml).join('')}
      </div>
    `)
    .join('');

  const extraBadgesHtml = payload.extraBadges?.length
    ? payload.extraBadges
        .map(b => `<span style="display: inline-block; padding: 3px 9px; margin-right: 6px; font-size: 10pt; background-color: #eef2ff; color: #3730a3; border-radius: 4px; border: 1px solid #c7d2fe;">${escapeHtml(b)}</span>`)
        .join('')
    : '';

  const agreedPill = payload.isAgreed
    ? `<span style="display: inline-block; padding: 3px 9px; font-size: 10pt; background-color: #dcfce7; color: #15803d; border-radius: 4px; border: 1px solid #86efac; font-weight: 600;">AGREED</span>`
    : '';

  const jurisdictionPill = payload.jurisdiction
    ? `<span style="display: inline-block; padding: 3px 9px; margin-right: 6px; font-size: 10pt; background-color: #f3f4f6; color: #374151; border-radius: 4px; border: 1px solid #d1d5db;">${escapeHtml(payload.jurisdiction)}</span>`
    : '';

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 2.5cm 2cm; }
    body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
    @page Section1 { mso-header-margin: 0.5in; mso-footer-margin: 0.5in; }
    div.Section1 { page: Section1; }
  </style>
</head>
<body>
<div class="Section1">
  <div style="text-align: center; padding-top: 100px; padding-bottom: 60px;">
    <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #6b7280; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 2px;">${escapeHtml(payload.analystTitle)} — Analysis Report</p>
    <h1 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 26pt; color: #111827; font-weight: 700; margin: 0 0 14px 0; letter-spacing: -0.5px;">${escapeHtml(payload.projectName)}</h1>
    <div style="width: 80px; height: 3px; background-color: #1e40af; margin: 0 auto 20px auto;"></div>
    <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #4b5563; margin: 0 0 4px 0;">${now}</p>
    <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #9ca3af; margin: 0;">
      ${totalGroups} section${totalGroups !== 1 ? 's' : ''} · ${totalPositions} position${totalPositions !== 1 ? 's' : ''}
    </p>
  </div>

  <br clear="all" style="page-break-before:always" />

  <div style="margin-bottom: 28px;">
    <h2 style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 15pt; color: #111827; border-bottom: 2px solid #1e40af; padding-bottom: 5px; margin: 0 0 14px 0;">Analysis Overview</h2>
    <div style="margin-bottom: 12px;">
      ${jurisdictionPill}
      <span style="display: inline-block; padding: 3px 9px; margin-right: 6px; font-size: 10pt; background-color: #f3f4f6; color: #374151; border-radius: 4px; border: 1px solid #d1d5db;">${escapeHtml(payload.analysisTypeLabel)}</span>
      <span style="display: inline-block; padding: 3px 9px; margin-right: 6px; font-size: 10pt; background-color: #f3f4f6; color: #374151; border-radius: 4px; border: 1px solid #d1d5db;">${escapeHtml(payload.perspectiveLabel)}</span>
      ${extraBadgesHtml}
      ${agreedPill}
    </div>
    <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #6b7280; margin: 0;">Analysed: ${analysedAt}</p>
  </div>

  ${groupsHtml}

  <div style="border-top: 1px solid #d1d5db; padding-top: 12px; margin-top: 40px;">
    <p style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #9ca3af; text-align: center;">
      This analysis report has been generated from the firm's internal ${escapeHtml(payload.analystTitle)} tool and is intended for internal use only.
      It does not constitute legal advice and should not be shared with clients without review.
    </p>
  </div>
</div>
</body>
</html>`;
}

interface Props {
  payload: AnalystReportExport;
  /** Rendered inside the Button; defaults to "Export to Word". */
  label?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ExportAnalystReportButton({
  payload,
  label = 'Export to Word',
  variant = 'outline',
  size = 'sm',
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    try {
      const html = generateHtml(payload);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filenameSafe = payload.projectName.replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim() || 'Analysis';
      a.href = url;
      a.download = `${payload.analystTitle} - ${filenameSafe} - ${format(new Date(), 'yyyy-MM-dd')}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Analysis report exported to Word');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={isExporting}>
      {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
      {label}
    </Button>
  );
}
