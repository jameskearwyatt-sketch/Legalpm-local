import ExcelJS from 'exceljs';
import { DraftLineItem, BUDGET_CATEGORIES, BudgetCategory } from '@/lib/hooks/useBudgetVersions';
import { formatCurrency } from '@/lib/currencyUtils';

interface ExportDraftBudgetOptions {
  items: DraftLineItem[];
  matterName: string;
  clientName: string;
  currency: string;
  draftName?: string;
  notes?: string;
  /** Conversion rate to apply to all monetary values */
  conversionRate?: number;
}

export async function exportDraftBudgetToExcel({
  items,
  matterName,
  clientName,
  currency,
  draftName = 'Draft Budget Proposal',
  notes,
  conversionRate = 1,
}: ExportDraftBudgetOptions): Promise<void> {
  const convert = (value: number) => value * conversionRate;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Baker McKenzie';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Budget Proposal', {
    views: [{ state: 'frozen', ySplit: 8 }],
  });

  // Set column widths - clean client-facing layout
  worksheet.columns = [
    { key: 'workItem', width: 50 },
    { key: 'provider', width: 20 },
    { key: 'lcFirmName', width: 25 },
    { key: 'feeAmount', width: 18 },
    { key: 'notes', width: 30 },
  ];

  // Professional color palette - Baker McKenzie inspired
  const primaryColor = 'FF1A1A2E'; // Dark navy
  const accentColor = 'FF8B0000'; // Deep red
  const lightGray = 'FFF8F9FA';
  const borderColor = 'FFE5E7EB';

  // Header styling
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: primaryColor },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
    size: 11,
    name: 'Calibri',
  };
  const titleFont: Partial<ExcelJS.Font> = {
    bold: true,
    size: 20,
    color: { argb: primaryColor },
    name: 'Calibri Light',
  };
  const subtitleFont: Partial<ExcelJS.Font> = {
    size: 12,
    color: { argb: 'FF4B5563' },
    name: 'Calibri',
  };

  // Title section - clean and professional
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Fee Estimate';
  titleCell.font = titleFont;
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 36;

  // Client info
  worksheet.mergeCells('A2:E2');
  const clientCell = worksheet.getCell('A2');
  clientCell.value = clientName;
  clientCell.font = { ...subtitleFont, bold: true, size: 14 };

  // Matter info
  worksheet.mergeCells('A3:E3');
  const matterCell = worksheet.getCell('A3');
  matterCell.value = matterName;
  matterCell.font = subtitleFont;

  // Draft info with date
  worksheet.mergeCells('A4:E4');
  const draftCell = worksheet.getCell('A4');
  draftCell.value = `${draftName} | ${new Date().toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })}`;
  draftCell.font = { ...subtitleFont, italic: true, color: { argb: 'FF6B7280' } };

  // Add notes if provided
  if (notes) {
    worksheet.mergeCells('A5:E5');
    const notesCell = worksheet.getCell('A5');
    notesCell.value = notes;
    notesCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    notesCell.alignment = { wrapText: true };
  }

  // Disclaimer/Draft watermark row
  worksheet.mergeCells('A6:E6');
  const disclaimerCell = worksheet.getCell('A6');
  disclaimerCell.value = 'DRAFT - FOR DISCUSSION PURPOSES ONLY';
  disclaimerCell.font = { bold: true, size: 10, color: { argb: accentColor } };
  disclaimerCell.alignment = { horizontal: 'center' };

  // Empty row for spacing
  worksheet.getRow(7).height = 15;

  // Column headers
  const headerRow = worksheet.getRow(8);
  headerRow.values = [
    'Scope of Work',
    'Provider',
    'Local Counsel',
    `Fee Estimate (${currency})`,
    'Remarks',
  ];
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: colNumber === 4 ? 'right' : 'left', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: primaryColor } },
    };
  });
  headerRow.height = 28;

  // Group items by category
  const groupedItems: Record<string, DraftLineItem[]> = {};
  BUDGET_CATEGORIES.forEach((cat) => {
    groupedItems[cat] = [];
  });

  const validItems = items.filter(item => item.work_item.trim() !== '');
  validItems.forEach((item) => {
    const category = (item.category as BudgetCategory) || 'Other';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  let rowIndex = 9;
  let grandTotal = 0;
  let bmTotal = 0;
  let lcTotal = 0;

  // Category colors - subtle and professional
  const categoryColors: Record<string, string> = {
    'Due Diligence': 'FFF0F7FF',
    'Documentation': 'FFF5F3FF',
    'Negotiations': 'FFFFFBEB',
    'Meetings': 'FFF0FDF4',
    'Regulatory': 'FFFEF2F2',
    'Closing': 'FFF0FDFA',
    'Tax': 'FFFEFCE8',
    'Legal Opinions': 'FFEEF2FF',
    'Other': 'FFF9FAFB',
  };

  // Process each category
  for (const category of BUDGET_CATEGORIES) {
    const categoryItems = groupedItems[category];
    if (categoryItems.length === 0) continue;

    // Category header row
    const catHeaderRow = worksheet.getRow(rowIndex);
    worksheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    catHeaderRow.getCell(1).value = category.toUpperCase();
    catHeaderRow.getCell(1).font = { bold: true, size: 10, color: { argb: primaryColor } };
    catHeaderRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: categoryColors[category] || lightGray },
    };
    catHeaderRow.getCell(1).border = {
      top: { style: 'thin', color: { argb: borderColor } },
      bottom: { style: 'thin', color: { argb: borderColor } },
    };
    catHeaderRow.height = 22;
    rowIndex++;

    let categoryTotal = 0;

    // Add items
    for (const item of categoryItems) {
      // Skip optional items that are not included
      if (item.is_optional && item.is_included === false) continue;
      
      const feeAmount = convert(item.fee_amount || 0);
      categoryTotal += feeAmount;
      
      if (item.provider === 'Baker McKenzie') {
        bmTotal += feeAmount;
      } else {
        lcTotal += feeAmount;
      }

      const dataRow = worksheet.getRow(rowIndex);
      
      // Format work item with optional indicator
      let workItemDisplay = item.work_item;
      if (item.is_optional) {
        workItemDisplay = `${item.work_item} (Optional)`;
      }
      
      dataRow.values = [
        workItemDisplay,
        item.provider,
        item.lc_firm_name || '',
        feeAmount,
        '',
      ];

      // Style the row
      dataRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      dataRow.getCell(2).font = { size: 10, color: { argb: 'FF6B7280' } };
      dataRow.getCell(3).font = { size: 10, color: { argb: 'FF6B7280' } };
      
      // Format fee amount
      dataRow.getCell(4).numFmt = '#,##0';
      dataRow.getCell(4).alignment = { horizontal: 'right' };
      dataRow.getCell(4).font = { size: 11 };
      
      if (item.is_optional) {
        dataRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
        dataRow.getCell(4).font = { italic: true, color: { argb: 'FF6B7280' } };
      }

      // Alternate row colors
      if (rowIndex % 2 === 0) {
        dataRow.eachCell((cell) => {
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).pattern !== 'solid') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' },
            };
          }
        });
      } else {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: lightGray },
          };
        });
      }

      // Add subtle borders
      dataRow.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'hair', color: { argb: borderColor } },
        };
      });

      rowIndex++;
    }

    grandTotal += categoryTotal;

    // Category subtotal (subtle)
    if (categoryTotal > 0) {
      const subtotalRow = worksheet.getRow(rowIndex);
      subtotalRow.values = ['', '', '', categoryTotal, ''];
      subtotalRow.getCell(4).numFmt = '#,##0';
      subtotalRow.getCell(4).alignment = { horizontal: 'right' };
      subtotalRow.getCell(4).font = { bold: true, size: 10, color: { argb: 'FF4B5563' } };
      subtotalRow.getCell(4).border = {
        top: { style: 'thin', color: { argb: borderColor } },
      };
      rowIndex++;
    }

    // Spacing between categories
    rowIndex++;
  }

  // Provider breakdown
  rowIndex++;
  const breakdownHeaderRow = worksheet.getRow(rowIndex);
  worksheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
  breakdownHeaderRow.getCell(1).value = 'Fee Breakdown by Provider';
  breakdownHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: primaryColor } };
  breakdownHeaderRow.height = 24;
  rowIndex++;

  // Baker McKenzie fees
  const bmRow = worksheet.getRow(rowIndex);
  bmRow.values = ['Baker McKenzie Fees', '', '', bmTotal, ''];
  bmRow.getCell(1).font = { size: 11 };
  bmRow.getCell(4).numFmt = '#,##0';
  bmRow.getCell(4).alignment = { horizontal: 'right' };
  bmRow.getCell(4).font = { size: 11 };
  rowIndex++;

  // Local Counsel fees
  if (lcTotal > 0) {
    const lcRow = worksheet.getRow(rowIndex);
    lcRow.values = ['Local Counsel Fees', '', '', lcTotal, ''];
    lcRow.getCell(1).font = { size: 11 };
    lcRow.getCell(4).numFmt = '#,##0';
    lcRow.getCell(4).alignment = { horizontal: 'right' };
    lcRow.getCell(4).font = { size: 11 };
    rowIndex++;
  }

  // Grand total row
  rowIndex++;
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.values = ['TOTAL FEE ESTIMATE', '', '', grandTotal, ''];
  totalRow.getCell(1).font = { bold: true, size: 13, color: { argb: primaryColor } };
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(4).alignment = { horizontal: 'right' };
  totalRow.getCell(4).font = { bold: true, size: 13, color: { argb: primaryColor } };
  totalRow.getCell(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: primaryColor } },
      bottom: { style: 'double', color: { argb: primaryColor } },
    };
  });
  totalRow.height = 28;

  // Footer with assumptions/notes
  rowIndex += 3;
  worksheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
  const footerCell = worksheet.getCell(`A${rowIndex}`);
  footerCell.value = 'Notes:';
  footerCell.font = { bold: true, size: 10, color: { argb: 'FF6B7280' } };
  rowIndex++;

  const assumptions = [
    'This fee estimate is provided for discussion purposes and is subject to change.',
    'Fees are based on our current understanding of the scope of work.',
    'Disbursements and out-of-pocket expenses are not included unless otherwise stated.',
    'Local counsel fees are estimates and subject to confirmation by the respective firms.',
  ];

  for (const assumption of assumptions) {
    worksheet.mergeCells(`A${rowIndex}:E${rowIndex}`);
    const noteCell = worksheet.getCell(`A${rowIndex}`);
    noteCell.value = `• ${assumption}`;
    noteCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
    noteCell.alignment = { wrapText: true };
    rowIndex++;
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
  link.download = `Fee_Estimate_${safeClientName}_${safeMatterName}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
