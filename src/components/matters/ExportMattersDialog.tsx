import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2 } from 'lucide-react';
import { MatterWithFinancials, MatterCategory } from '@/lib/hooks/useMatters';
import { useExchangeRates } from '@/lib/hooks/useExchangeRates';
import { convertToUsd } from '@/lib/currencyUtils';
import { getMatterClientDisplayName } from '@/lib/clientUtils';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';

interface ExportMattersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matters: MatterWithFinancials[];
  userName: string;
}

const categories: { value: MatterCategory; label: string }[] = [
  { value: 'Live', label: 'Live Matters' },
  { value: 'Pipeline', label: 'Pipeline Matters' },
  { value: 'Closed', label: 'Closed Matters' },
  { value: 'Lost', label: 'Lost Matters' },
];

export function ExportMattersDialog({ open, onOpenChange, matters, userName }: ExportMattersDialogProps) {
  const [selectedCategories, setSelectedCategories] = useState<MatterCategory[]>(['Live']);
  const [isExporting, setIsExporting] = useState(false);
  const { data: exchangeData } = useExchangeRates();
  const { toast } = useToast();

  const gbpToUsdRate = exchangeData?.rates?.GBP ? 1 / exchangeData.rates.GBP : 1.35;
  const liveRates = exchangeData?.rates;

  const toUsd = (amount: number, feeCurrency: string, exchangeRate: number) => {
    return convertToUsd(amount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
  };

  const isMyMatter = (matter: MatterWithFinancials): boolean => {
    if (!userName) return false;
    const mma = (matter as any).matter_managing_attorney || '';
    const bp = matter.lead_partner || '';
    const userNameLower = userName.toLowerCase().trim();
    const isMMA = mma.trim() !== '' && mma.toLowerCase().trim() === userNameLower;
    const isBP = bp.trim() !== '' && bp.toLowerCase().trim() === userNameLower;
    return isMMA || isBP;
  };

  const calculateTotals = (data: MatterWithFinancials[]) => {
    return data.reduce(
      (acc, m) => {
        const feeCurrency = m.fee_currency || 'GBP';
        const exchangeRate = m.exchange_rate || 1;
        return {
          budget: acc.budget + toUsd(m.fee_amount_upper_end || 0, feeCurrency, exchangeRate),
          wip: acc.wip + toUsd(m.latest_snapshot?.wip_amount || 0, feeCurrency, exchangeRate),
          billed: acc.billed + toUsd(m.latest_snapshot?.billed_amount || 0, feeCurrency, exchangeRate),
          paid: acc.paid + toUsd(m.latest_snapshot?.paid_amount || 0, feeCurrency, exchangeRate),
        };
      },
      { budget: 0, wip: 0, billed: 0, paid: 0 }
    );
  };

  const headers = [
    'Client',
    'Matter Name',
    'Matter Number',
    'Practice Area',
    'Total Budget (USD)',
    'WIP (USD)',
    'Billed (USD)',
    'Paid (USD)',
  ];

  const addHeaderRow = (worksheet: ExcelJS.Worksheet, rowIndex: number) => {
    const headerRow = worksheet.getRow(rowIndex);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF2563EB' } },
        bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FF2563EB' } },
        right: { style: 'thin', color: { argb: 'FF2563EB' } },
      };
    });
    headerRow.height = 28;
  };

  const addDataRows = (worksheet: ExcelJS.Worksheet, data: MatterWithFinancials[], startRowIndex: number) => {
    data.forEach((matter, index) => {
      const row = worksheet.getRow(startRowIndex + index);
      const clientName = getMatterClientDisplayName(matter);
      const feeCurrency = matter.fee_currency || 'GBP';
      const exchangeRate = matter.exchange_rate || 1;

      const budgetUsd = toUsd(matter.fee_amount_upper_end || 0, feeCurrency, exchangeRate);
      const wipUsd = toUsd(matter.latest_snapshot?.wip_amount || 0, feeCurrency, exchangeRate);
      const billedUsd = toUsd(matter.latest_snapshot?.billed_amount || 0, feeCurrency, exchangeRate);
      const paidUsd = toUsd(matter.latest_snapshot?.paid_amount || 0, feeCurrency, exchangeRate);

      row.getCell(1).value = clientName;
      row.getCell(2).value = matter.matter_name;
      row.getCell(3).value = matter.cm_number || '-';
      row.getCell(4).value = matter.practice_area || '-';
      row.getCell(5).value = budgetUsd;
      row.getCell(6).value = wipUsd;
      row.getCell(7).value = billedUsd;
      row.getCell(8).value = paidUsd;

      [5, 6, 7, 8].forEach((col) => {
        row.getCell(col).numFmt = '"$"#,##0';
      });

      const fillColor = index % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
      for (let col = 1; col <= 8; col++) {
        const cell = row.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        cell.alignment = { vertical: 'middle' };
      }
      row.height = 24;
    });
    return startRowIndex + data.length;
  };

  const addSubtotalRow = (
    worksheet: ExcelJS.Worksheet,
    rowIndex: number,
    label: string,
    totals: { budget: number; wip: number; billed: number; paid: number },
    bgColor: string = 'FFDBEAFE'
  ) => {
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(5).value = totals.budget;
    row.getCell(6).value = totals.wip;
    row.getCell(7).value = totals.billed;
    row.getCell(8).value = totals.paid;

    [5, 6, 7, 8].forEach((col) => {
      row.getCell(col).numFmt = '"$"#,##0';
      row.getCell(col).font = { bold: true };
    });

    for (let col = 1; col <= 8; col++) {
      row.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      row.getCell(col).border = {
        top: { style: 'medium', color: { argb: 'FF3B82F6' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      };
    }
    row.height = 28;
  };

  const addSectionTitle = (worksheet: ExcelJS.Worksheet, rowIndex: number, title: string) => {
    worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
    const cell = worksheet.getCell(`A${rowIndex}`);
    cell.value = title;
    cell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    worksheet.getRow(rowIndex).height = 28;
  };

  const handleExport = async () => {
    if (selectedCategories.length === 0) {
      toast({ title: 'Please select at least one category', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    try {
      const filteredMatters = matters.filter(m => selectedCategories.includes(m.category as MatterCategory));
      
      if (filteredMatters.length === 0) {
        toast({ title: 'No matters to export', description: 'Selected categories have no matters', variant: 'destructive' });
        setIsExporting(false);
        return;
      }

      const myMatters = filteredMatters.filter(isMyMatter);
      const otherMatters = filteredMatters.filter((m) => !isMyMatter(m));

      const myTotals = calculateTotals(myMatters);
      const otherTotals = calculateTotals(otherMatters);
      const grandTotals = {
        budget: myTotals.budget + otherTotals.budget,
        wip: myTotals.wip + otherTotals.wip,
        billed: myTotals.billed + otherTotals.billed,
        paid: myTotals.paid + otherTotals.paid,
      };

      const title = selectedCategories.length === 1 
        ? `${selectedCategories[0]} Matters` 
        : `Matters Export (${selectedCategories.join(', ')})`;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Matter Management';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(title.slice(0, 31), {
        views: [{ state: 'frozen', ySplit: 3 }],
      });

      // Title row
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 35;

      // Subtitle with date
      worksheet.mergeCells('A2:H2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = `Generated on ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`;
      subtitleCell.font = { size: 11, italic: true, color: { argb: 'FF6B7280' } };
      subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 22;

      let currentRow = 4;

      // Section 1: My Matters
      addSectionTitle(worksheet, currentRow, `Matters where I am MMA or Billing Partner (${myMatters.length})`);
      currentRow++;

      addHeaderRow(worksheet, currentRow);
      currentRow++;

      if (myMatters.length > 0) {
        currentRow = addDataRows(worksheet, myMatters, currentRow);
      } else {
        const emptyRow = worksheet.getRow(currentRow);
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        emptyRow.getCell(1).value = 'No matters in this category';
        emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
        emptyRow.getCell(1).alignment = { horizontal: 'center' };
        emptyRow.height = 24;
        currentRow++;
      }

      addSubtotalRow(worksheet, currentRow, 'SUBTOTAL (My Matters)', myTotals, 'FFD1FAE5');
      currentRow += 2;

      // Section 2: Other Matters
      addSectionTitle(worksheet, currentRow, `Other Matters (${otherMatters.length})`);
      currentRow++;

      addHeaderRow(worksheet, currentRow);
      currentRow++;

      if (otherMatters.length > 0) {
        currentRow = addDataRows(worksheet, otherMatters, currentRow);
      } else {
        const emptyRow = worksheet.getRow(currentRow);
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        emptyRow.getCell(1).value = 'No matters in this category';
        emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
        emptyRow.getCell(1).alignment = { horizontal: 'center' };
        emptyRow.height = 24;
        currentRow++;
      }

      addSubtotalRow(worksheet, currentRow, 'SUBTOTAL (Other Matters)', otherTotals, 'FFDBEAFE');
      currentRow += 2;

      // Grand Total
      addSubtotalRow(worksheet, currentRow, 'GRAND TOTAL', grandTotals, 'FFFEF3C7');
      const grandTotalRow = worksheet.getRow(currentRow);
      for (let col = 1; col <= 8; col++) {
        grandTotalRow.getCell(col).font = { bold: true, size: 12 };
        grandTotalRow.getCell(col).border = {
          top: { style: 'double', color: { argb: 'FF1F2937' } },
          bottom: { style: 'double', color: { argb: 'FF1F2937' } },
        };
      }
      grandTotalRow.height = 32;

      // Set column widths
      worksheet.getColumn(1).width = 22;
      worksheet.getColumn(2).width = 30;
      worksheet.getColumn(3).width = 18;
      worksheet.getColumn(4).width = 18;
      worksheet.getColumn(5).width = 18;
      worksheet.getColumn(6).width = 15;
      worksheet.getColumn(7).width = 15;
      worksheet.getColumn(8).width = 15;

      // Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = selectedCategories.length === 1 
        ? `${selectedCategories[0]}_Matters` 
        : 'Matters_Export';
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Export successful', description: `Exported ${filteredMatters.length} matters to Excel` });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Export failed', description: 'Failed to generate Excel file', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCategory = (category: MatterCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getCategoryCount = (category: MatterCategory) => {
    return matters.filter(m => m.category === category).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Matters</DialogTitle>
          <DialogDescription>
            Select which categories of matters to export to Excel.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {categories.map(({ value, label }) => {
            const count = getCategoryCount(value);
            return (
              <label
                key={value}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedCategories.includes(value)}
                  onCheckedChange={() => toggleCategory(value)}
                />
                <span className="flex-1 font-medium">{label}</span>
                <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting || selectedCategories.length === 0}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
