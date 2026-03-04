import ExcelJS from 'exceljs';
import { DraftLineItem, BUDGET_CATEGORIES, BudgetCategory } from '@/lib/hooks/useBudgetVersions';
import { formatCurrency } from '@/lib/currencyUtils';

interface ExportBudgetOptions {
  items: DraftLineItem[];
  matterName: string;
  clientName: string;
  currency: string;
  versionNumber?: number;
  versionDate?: string;
  /** Conversion rate to apply to all monetary values (e.g., for quote → billing currency conversion) */
  conversionRate?: number;
}

export async function exportBudgetToExcel({
  items,
  matterName,
  clientName,
  currency,
  versionNumber,
  versionDate,
  conversionRate = 1,
}: ExportBudgetOptions): Promise<void> {
  // Helper to convert values from quote currency to billing currency
  const convert = (value: number) => value * conversionRate;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Matter Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Budget Utilisation Report', {
    views: [{ state: 'frozen', ySplit: 6 }],
  });

  // Set column widths
  worksheet.columns = [
    { key: 'category', width: 18 },
    { key: 'workItem', width: 40 },
    { key: 'provider', width: 16 },
    { key: 'lcFirmName', width: 20 },
    { key: 'budget', width: 15 },
    { key: 'rawWip', width: 15 },
    { key: 'writeOff', width: 15 },
    { key: 'adjustedWip', width: 15 },
    { key: 'remaining', width: 15 },
    { key: 'burnPct', width: 12 },
  ];

  // Header styling
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
  };
  const titleFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 14,
    color: { argb: 'FF1E3A5F' },
  };
  const subtitleFont: Partial<ExcelJS.Font> = {
    size: 11,
    color: { argb: 'FF666666' },
  };

  // Title section
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Detailed Budget Utilisation Report';
  titleCell.font = titleFont;
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 24;

  // Client and Matter info
  worksheet.mergeCells('A2:J2');
  const clientCell = worksheet.getCell('A2');
  clientCell.value = `Client: ${clientName}`;
  clientCell.font = subtitleFont;

  worksheet.mergeCells('A3:J3');
  const matterCell = worksheet.getCell('A3');
  matterCell.value = `Matter: ${matterName}`;
  matterCell.font = subtitleFont;

  // Version and date info
  worksheet.mergeCells('A4:J4');
  const versionCell = worksheet.getCell('A4');
  versionCell.value = `Budget Version: ${versionNumber || 'N/A'} | Report Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  versionCell.font = subtitleFont;

  // Empty row
  worksheet.getRow(5).height = 10;

  // Column headers
  const headerRow = worksheet.getRow(6);
  headerRow.values = [
    'Category',
    'Work Item',
    'Provider',
    'LC Firm',
    `Budget (${currency})`,
    `Raw WIP (${currency})`,
    `Write-off (${currency})`,
    `Adjusted WIP (${currency})`,
    `Remaining (${currency})`,
    'Burn %',
  ];
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
    };
  });
  headerRow.height = 22;

  // Group items by category
  const groupedItems: Record<string, DraftLineItem[]> = {};
  BUDGET_CATEGORIES.forEach((cat) => {
    groupedItems[cat] = [];
  });

  items.forEach((item) => {
    const category = (item.category as BudgetCategory) || 'Other';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  let rowIndex = 7;
  let grandTotalBudget = 0;
  let grandTotalRawWip = 0;
  let grandTotalWriteOff = 0;
  let grandTotalAdjustedWip = 0;

  // Category colors for Excel
  const categoryColors: Record<string, string> = {
    'Due Diligence': 'FFDBEAFE',
    'Documentation': 'FFE9D5FF',
    'Negotiations': 'FFFEF3C7',
    'Meetings': 'FFD1FAE5',
    'Regulatory': 'FFFEE2E2',
    'Closing': 'FFCCFBF1',
    'Tax': 'FFFFEDD5',
    'Legal Opinions': 'FFE0E7FF',
    'Other': 'FFF3F4F6',
  };

  // Process each category
  for (const category of BUDGET_CATEGORIES) {
    const categoryItems = groupedItems[category];
    if (categoryItems.length === 0) continue;

    let categoryBudget = 0;
    let categoryRawWip = 0;
    let categoryWriteOff = 0;

    // Category header row
    const catHeaderRow = worksheet.getRow(rowIndex);
    worksheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
    catHeaderRow.getCell(1).value = category;
    catHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E3A5F' } };
    catHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: categoryColors[category] || 'FFF3F4F6' },
    };
    catHeaderRow.height = 20;
    rowIndex++;

    // Add items
    for (const item of categoryItems) {
      // Convert all monetary values from quote currency to billing currency
      const rawWip = convert(item.wip_amount || 0);
      const writeOff = convert(item.wip_write_off || 0);
      const adjustedWip = rawWip - writeOff;
      const budget = convert(item.fee_amount || 0);
      const remaining = budget - adjustedWip;
      const burnPct = budget > 0 ? (adjustedWip / budget) * 100 : 0;

      categoryBudget += budget;
      categoryRawWip += rawWip;
      categoryWriteOff += writeOff;

      const dataRow = worksheet.getRow(rowIndex);
      dataRow.values = [
        item.category || 'Other',
        item.work_item,
        item.provider,
        item.lc_firm_name || '',
        budget,
        rawWip,
        writeOff,
        adjustedWip,
        remaining,
        burnPct,
      ];

      // Format currency cells
      [5, 6, 7, 8, 9].forEach((col) => {
        const cell = dataRow.getCell(col);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      });

      // Format percentage
      dataRow.getCell(10).numFmt = '0.0%';
      dataRow.getCell(10).value = burnPct / 100;
      dataRow.getCell(10).alignment = { horizontal: 'center' };

      // Highlight write-offs in red
      if (writeOff > 0) {
        dataRow.getCell(7).font = { color: { argb: 'FFDC2626' }, bold: true };
      }

      // Color burn percentage
      if (burnPct > 100) {
        dataRow.getCell(10).font = { color: { argb: 'FFDC2626' }, bold: true };
      } else if (burnPct >= 80) {
        dataRow.getCell(10).font = { color: { argb: 'FFD97706' } };
      } else {
        dataRow.getCell(10).font = { color: { argb: 'FF059669' } };
      }

      // Alternate row colors within category
      if ((rowIndex - 7) % 2 === 0) {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAFAFA' },
          };
        });
      }

      rowIndex++;
    }

    // Category subtotal
    const categoryAdjustedWip = categoryRawWip - categoryWriteOff;
    const categoryRemaining = categoryBudget - categoryAdjustedWip;
    const categoryBurnPct = categoryBudget > 0 ? (categoryAdjustedWip / categoryBudget) * 100 : 0;

    const subtotalRow = worksheet.getRow(rowIndex);
    subtotalRow.values = [
      '',
      `${category} Subtotal`,
      '',
      '',
      categoryBudget,
      categoryRawWip,
      categoryWriteOff,
      categoryAdjustedWip,
      categoryRemaining,
      categoryBurnPct / 100,
    ];
    subtotalRow.font = { bold: true };
    subtotalRow.getCell(2).alignment = { horizontal: 'right' };
    [5, 6, 7, 8, 9].forEach((col) => {
      subtotalRow.getCell(col).numFmt = '#,##0.00';
      subtotalRow.getCell(col).alignment = { horizontal: 'right' };
    });
    subtotalRow.getCell(10).numFmt = '0.0%';
    subtotalRow.getCell(10).alignment = { horizontal: 'center' };

    if (categoryWriteOff > 0) {
      subtotalRow.getCell(7).font = { color: { argb: 'FFDC2626' }, bold: true };
    }

    subtotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    grandTotalBudget += categoryBudget;
    grandTotalRawWip += categoryRawWip;
    grandTotalWriteOff += categoryWriteOff;
    grandTotalAdjustedWip += categoryAdjustedWip;

    rowIndex++;
    // Empty row between categories
    rowIndex++;
  }

  // Grand total row
  const grandTotalRemaining = grandTotalBudget - grandTotalAdjustedWip;
  const grandTotalBurnPct = grandTotalBudget > 0 ? (grandTotalAdjustedWip / grandTotalBudget) * 100 : 0;

  const totalRow = worksheet.getRow(rowIndex);
  totalRow.values = [
    '',
    'GRAND TOTAL',
    '',
    '',
    grandTotalBudget,
    grandTotalRawWip,
    grandTotalWriteOff,
    grandTotalAdjustedWip,
    grandTotalRemaining,
    grandTotalBurnPct / 100,
  ];
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell(2).alignment = { horizontal: 'right' };
  [5, 6, 7, 8, 9].forEach((col) => {
    totalRow.getCell(col).numFmt = '#,##0.00';
    totalRow.getCell(col).alignment = { horizontal: 'right' };
    totalRow.getCell(col).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
  });
  totalRow.getCell(10).numFmt = '0.0%';
  totalRow.getCell(10).alignment = { horizontal: 'center' };
  totalRow.getCell(10).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };

  if (grandTotalWriteOff > 0) {
    totalRow.getCell(7).font = { color: { argb: 'FFDC2626' }, bold: true, size: 12 };
  }

  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1E3A5F' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A5F' } },
    };
  });

  // Summary section for write-offs
  rowIndex += 3;
  worksheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
  const writeOffSummaryHeader = worksheet.getCell(`A${rowIndex}`);
  writeOffSummaryHeader.value = 'Write-Off Summary (for Billing Department)';
  writeOffSummaryHeader.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } };
  rowIndex++;

  worksheet.mergeCells(`A${rowIndex}:J${rowIndex}`);
  const writeOffTotal = worksheet.getCell(`A${rowIndex}`);
  writeOffTotal.value = `Total Write-Off Amount: ${formatCurrency(grandTotalWriteOff, currency)}`;
  writeOffTotal.font = { bold: true, size: 11 };
  rowIndex += 2;

  // List items with write-offs
  const itemsWithWriteOff = items.filter((item) => (item.wip_write_off || 0) > 0);
  if (itemsWithWriteOff.length > 0) {
    const woHeaderRow = worksheet.getRow(rowIndex);
    woHeaderRow.values = ['Category', 'Work Item', 'Provider', 'LC Firm', '', '', `Write-Off (${currency})`, '', '', ''];
    woHeaderRow.font = { bold: true };
    woHeaderRow.getCell(7).alignment = { horizontal: 'right' };
    rowIndex++;

    for (const item of itemsWithWriteOff) {
      const woRow = worksheet.getRow(rowIndex);
      woRow.values = [
        item.category || 'Other',
        item.work_item,
        item.provider,
        item.lc_firm_name || '',
        '',
        '',
        convert(item.wip_write_off || 0),
        '',
        '',
        '',
      ];
      woRow.getCell(7).numFmt = '#,##0.00';
      woRow.getCell(7).alignment = { horizontal: 'right' };
      woRow.getCell(7).font = { color: { argb: 'FFDC2626' } };
      rowIndex++;
    }
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeMatterName = matterName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `Budget_Report_${safeClientName}_${safeMatterName}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
