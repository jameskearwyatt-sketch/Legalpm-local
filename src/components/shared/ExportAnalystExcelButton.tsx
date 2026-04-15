/**
 * Shared "Export to Excel" button for the 5 analyst report components.
 *
 * Reuses the same `AnalystReportExport` payload that `ExportAnalystReportButton`
 * already computes, so each analyst report only has to compute the payload once
 * and hand it to both exporters. Produces a two-sheet .xlsx:
 *   - "Overview" — metadata pairs (project, type, perspective, jurisdiction,
 *     badges, agreed, analysed date, counts).
 *   - "Positions" — one row per position with group, category, confidence,
 *     market-position, summary, comparison, variance notes, source clauses.
 *
 * Complements the Word export (which attorneys use for partner- and client-
 * facing prints). Excel is the format partners want when doing diligence
 * reviews — filterable, sortable, easy to slice.
 */
import { useState } from 'react';
import ExcelJS from 'exceljs';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type {
  AnalystReportExport,
  ExportConfidence,
  ExportMarketPosition,
} from './ExportAnalystReportButton';

const CONFIDENCE_LABEL: Record<Exclude<ExportConfidence, null>, string> = {
  high: 'High',
  medium: 'Medium',
  review_required: 'Review Required',
};

const MARKET_LABEL: Record<Exclude<ExportMarketPosition, null>, string> = {
  on_market: 'On Market',
  off_market: 'Off Market',
  way_off_market: 'Way Off Market',
};

const CONFIDENCE_COLOR: Record<Exclude<ExportConfidence, null>, { bg: string; font: string }> = {
  high: { bg: 'FFDBEAFE', font: 'FF1E40AF' },
  medium: { bg: 'FFFEF3C7', font: 'FF92400E' },
  review_required: { bg: 'FFFEE2E2', font: 'FF991B1B' },
};

const MARKET_COLOR: Record<Exclude<ExportMarketPosition, null>, { bg: string; font: string }> = {
  on_market: { bg: 'FFF3F4F6', font: 'FF4B5563' },
  off_market: { bg: 'FFDBEAFE', font: 'FF1E40AF' },
  way_off_market: { bg: 'FFFEE2E2', font: 'FF991B1B' },
};

function stripMarkers(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes
    .replace(/\[(ON MARKET|OFF MARKET|WAY OFF MARKET)\]\s*/gi, '')
    .replace(/\[(BUYER|SELLER|OFFTAKER|GENERATOR|TENANT|PROVIDER|SUPPLIER)-FRIENDLY\]\s*/gi, '')
    .replace(/\[BALANCED\]\s*/gi, '')
    .trim();
}

async function generateXlsx(payload: AnalystReportExport): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = payload.analystTitle;
  wb.created = new Date();

  // Overview sheet
  const overview = wb.addWorksheet('Overview', { views: [{ state: 'frozen', ySplit: 1 }] });
  overview.columns = [
    { key: 'field', width: 28 },
    { key: 'value', width: 70 },
  ];
  const header = overview.getRow(1);
  header.values = ['Field', 'Value'];
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  header.alignment = { horizontal: 'left', vertical: 'middle' };
  header.height = 22;

  const totalPositions = payload.positionsByGroup.reduce((sum, g) => sum + g.positions.length, 0);
  const overviewRows: Array<[string, string]> = [
    ['Analyst', payload.analystTitle],
    ['Project', payload.projectName],
    ['Analysis Type', payload.analysisTypeLabel],
    ['Perspective', payload.perspectiveLabel],
    ['Jurisdiction', payload.jurisdiction || '—'],
    ['Badges', payload.extraBadges?.filter(Boolean).join(', ') || '—'],
    ['Agreed', payload.isAgreed ? 'Yes' : 'No'],
    ['Analysed At', format(new Date(payload.createdAt), 'PPP p')],
    ['Sections', String(payload.positionsByGroup.length)],
    ['Total Positions', String(totalPositions)],
  ];
  for (const [field, value] of overviewRows) {
    const row = overview.addRow({ field, value });
    row.getCell('field').font = { bold: true, color: { argb: 'FF1E3A5F' } };
    row.alignment = { wrapText: true, vertical: 'top' };
  }

  // Positions sheet
  const ws = wb.addWorksheet('Positions', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { key: 'group', width: 26 },
    { key: 'category', width: 30 },
    { key: 'confidence', width: 16 },
    { key: 'market', width: 16 },
    { key: 'summary', width: 70 },
    { key: 'comparison', width: 50 },
    { key: 'variance', width: 50 },
    { key: 'source', width: 24 },
  ];
  const head = ws.getRow(1);
  head.values = [
    'Category Group',
    'Category',
    'Confidence',
    'Market Position',
    'Position Summary',
    'Comparison / Bible',
    'Variance Notes',
    'Source Clauses',
  ];
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  head.alignment = { horizontal: 'center', vertical: 'middle' };
  head.height = 26;

  for (const group of payload.positionsByGroup) {
    for (const p of group.positions) {
      const row = ws.addRow({
        group: group.group,
        category: p.category,
        confidence: p.confidence ? CONFIDENCE_LABEL[p.confidence] : '—',
        market: p.marketPosition ? MARKET_LABEL[p.marketPosition] : '—',
        summary: p.positionSummary || '',
        comparison: p.comparisonPosition || '',
        variance: stripMarkers(p.varianceNotes),
        source: p.sourceText || '',
      });
      row.alignment = { wrapText: true, vertical: 'top' };
      row.font = { size: 10 };

      if (p.confidence) {
        const color = CONFIDENCE_COLOR[p.confidence];
        const cell = row.getCell('confidence');
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
        cell.font = { color: { argb: color.font }, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (p.marketPosition) {
        const color = MARKET_COLOR[p.marketPosition];
        const cell = row.getCell('market');
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.bg } };
        cell.font = { color: { argb: color.font }, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

interface Props {
  payload: AnalystReportExport;
}

export function ExportAnalystExcelButton({ payload }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const blob = await generateXlsx(payload);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const safeName = payload.projectName.replace(/[^a-z0-9-_ ]/gi, '').slice(0, 60) || 'Analysis';
      link.download = `${payload.analystTitle} - ${safeName} - ${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Excel export ready');
    } catch (err) {
      console.error('Excel export failed', err);
      toast.error('Excel export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4 mr-1" />
      )}
      Export Excel
    </Button>
  );
}
