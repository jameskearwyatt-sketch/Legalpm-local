/**
 * Export pricing proposal to Excel with AFA (Alternative Fee Arrangement) filters applied.
 * This generates client-facing proposals with adjusted figures and explanatory comments.
 * 
 * IMPORTANT: All figures are rounded to the nearest $1,000 for client-facing output.
 */

import ExcelJS from 'exceljs';
import { DraftProposalItem, BUDGET_CATEGORIES, ExportFigureSettings, FigureType } from '@/lib/hooks/usePricingProposals';
import { ProposalAFA, AFA_TYPE_LABELS } from '@/lib/hooks/useProposalAFAs';
import { applyAFAFilters, AFAFilteredItem, getItemFeeByFigureType } from '@/lib/afaFilterUtils';

/**
 * Round a number to the nearest 1000.
 * E.g., 1499 -> 1000, 1500 -> 2000, 12345 -> 12000
 */
function roundToNearest1000(value: number): number {
  return Math.round(value / 1000) * 1000;
}

interface ExportAFAProposalOptions {
  items: DraftProposalItem[];
  enabledAFAs: ProposalAFA[];
  proposalName: string;
  clientName: string;
  currency: string;
  baselineTotal: number;
  notes?: string;
  // New figure settings
  excelExportFigures?: ExportFigureSettings | null;
  afaBaseFigure?: FigureType | null;
}

export async function exportAFAProposalToExcel({
  items,
  enabledAFAs,
  proposalName,
  clientName,
  currency,
  baselineTotal,
  notes,
  excelExportFigures,
  afaBaseFigure,
}: ExportAFAProposalOptions): Promise<void> {
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
  
  // Determine which columns to export
  const exportLower = excelExportFigures?.lower ?? false;
  const exportMidpoint = excelExportFigures?.midpoint ?? true; // Default to midpoint if no settings
  const exportUpper = excelExportFigures?.upper ?? false;
  
  // Calculate how many fee columns we need
  const feeColumnCount = [exportLower, exportMidpoint, exportUpper].filter(Boolean).length;
  
  // Use afaBaseFigure for AFA calculations, default to midpoint
  const baseFigure: FigureType = afaBaseFigure || 'midpoint';
  
  // Calculate baseline total using the selected figure type
  const calculatedBaselineTotal = items.reduce((sum, item) => 
    sum + getItemFeeByFigureType(item, baseFigure), 0
  );
  
  // Apply AFA filters to get adjusted items (using the base figure)
  const filterResult = applyAFAFilters(items, enabledAFAs, calculatedBaselineTotal, currencySymbol, baseFigure);
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Baker McKenzie';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Fee Proposal');

  // Professional color palette
  const primaryColor = 'FF1A1A2E';
  const accentColor = 'FF8B0000';
  const lightGray = 'FFF8F9FA';
  const borderColor = 'FFE5E7EB';
  const afaHighlightColor = 'FFF0F9FF'; // Light blue for AFA-adjusted items

  // Build column definitions dynamically based on selected figures
  const columns: { key: string; width: number }[] = [
    { key: 'workItem', width: 45 },
    { key: 'provider', width: 18 },
    { key: 'lcFirmName', width: 20 },
  ];
  
  if (exportLower) columns.push({ key: 'feeLower', width: 16 });
  if (exportMidpoint) columns.push({ key: 'feeMidpoint', width: 16 });
  if (exportUpper) columns.push({ key: 'feeUpper', width: 16 });
  
  columns.push({ key: 'comments', width: 40 });
  
  worksheet.columns = columns;

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

  // Calculate last column letter for merge cells
  const totalColumns = columns.length;
  const lastColLetter = String.fromCharCode(64 + totalColumns); // A=65, so 64+n gives nth letter
  
  // Title section
  worksheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Fee Proposal';
  titleCell.font = titleFont;
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 36;

  // Client info
  worksheet.mergeCells(`A2:${lastColLetter}2`);
  const clientCell = worksheet.getCell('A2');
  clientCell.value = clientName;
  clientCell.font = { ...subtitleFont, bold: true, size: 14 };

  // Proposal info
  worksheet.mergeCells(`A3:${lastColLetter}3`);
  const proposalCell = worksheet.getCell('A3');
  proposalCell.value = `${proposalName} | ${new Date().toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  })}`;
  proposalCell.font = { ...subtitleFont, italic: true, color: { argb: 'FF6B7280' } };

  let currentRow = 4;

  // Add AFA summary if any AFAs are applied
  if (filterResult.appliedAFAs.length > 0) {
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const afaSummaryHeader = worksheet.getCell(`A${currentRow}`);
    afaSummaryHeader.value = 'Fee Arrangement';
    afaSummaryHeader.font = { bold: true, size: 11, color: { argb: primaryColor } };
    currentRow++;

    // Add global comment if present
    if (filterResult.globalComment) {
      worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
      const globalCommentCell = worksheet.getCell(`A${currentRow}`);
      globalCommentCell.value = filterResult.globalComment;
      globalCommentCell.font = { size: 10, color: { argb: 'FF2563EB' }, italic: true };
      globalCommentCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: afaHighlightColor },
      };
      globalCommentCell.alignment = { wrapText: true };
      currentRow++;
    }
    currentRow++;
  }

  // Notes if provided
  if (notes) {
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const notesCell = worksheet.getCell(`A${currentRow}`);
    notesCell.value = notes;
    notesCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    notesCell.alignment = { wrapText: true };
    currentRow++;
  }

  // Draft watermark
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
  const disclaimerCell = worksheet.getCell(`A${currentRow}`);
  disclaimerCell.value = 'DRAFT - FOR DISCUSSION PURPOSES ONLY';
  disclaimerCell.font = { bold: true, size: 10, color: { argb: accentColor } };
  disclaimerCell.alignment = { horizontal: 'center' };
  currentRow += 2;

  // Build dynamic header values
  const headerValues: string[] = ['Scope of Work', 'Provider', 'Local Counsel'];
  if (exportLower) headerValues.push(`Lower Range (${currency})`);
  if (exportMidpoint) headerValues.push(`Midpoint (${currency})`);
  if (exportUpper) headerValues.push(`Upper Range (${currency})`);
  headerValues.push('Notes');
  
  // Track which column indices are fee columns (for right-alignment)
  const feeColumnIndices: number[] = [];
  let colIdx = 4; // Fee columns start at column 4
  if (exportLower) feeColumnIndices.push(colIdx++);
  if (exportMidpoint) feeColumnIndices.push(colIdx++);
  if (exportUpper) feeColumnIndices.push(colIdx++);

  // Column headers
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = headerValues;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: feeColumnIndices.includes(colNumber) ? 'right' : 'left', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: primaryColor } },
    };
  });
  headerRow.height = 28;
  
  // Freeze pane at header row
  worksheet.views = [{ state: 'frozen', ySplit: currentRow }];
  currentRow++;

  // Category colors
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

  // Group items by category
  const groupedItems: Record<string, AFAFilteredItem[]> = {};
  BUDGET_CATEGORIES.forEach((cat) => {
    groupedItems[cat] = [];
  });

  const validItems = filterResult.items.filter(item => 
    item.work_item.trim() !== '' && (item.is_included !== false || !item.is_optional)
  );
  
  // Debug: Check for items that were in the reconciliation but excluded from export
  const reconciledItems = filterResult.items.filter(item => 
    (item.is_included !== false || !item.is_optional)
  );
  const reconciledBmTotal = reconciledItems.filter(i => i.provider === 'Baker McKenzie').reduce((s, i) => s + i.fee_amount, 0);
  const validBmTotal = validItems.filter(i => i.provider === 'Baker McKenzie').reduce((s, i) => s + i.fee_amount, 0);
  console.log('[Excel Export Debug]', {
    reconciledItemCount: reconciledItems.length,
    validItemCount: validItems.length,
    reconciledBmTotal,
    validBmTotal,
    difference: reconciledBmTotal - validBmTotal,
  });
  
  validItems.forEach((item) => {
    const category = item.category || 'Other';
    if (!groupedItems[category]) {
      groupedItems[category] = [];
    }
    groupedItems[category].push(item);
  });

  let grandTotal = 0;
  let bmTotal = 0;
  let lcTotal = 0;

  // Process each category
  for (const category of BUDGET_CATEGORIES) {
    const categoryItems = groupedItems[category];
    if (categoryItems.length === 0) continue;

    // Category header
    const catHeaderRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
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
    currentRow++;

    let categoryTotal = 0;

    // Add items - fee_amount is already properly rounded via largest remainder method in applyAFAFilters
    // Do NOT re-round, as this would break the reconciliation
    const rowFees: number[] = [];
    for (const item of categoryItems) {
      const feeAmount = item.fee_amount || 0;
      rowFees.push(feeAmount);
      categoryTotal += feeAmount;
      
      if (item.provider === 'Baker McKenzie') {
        bmTotal += feeAmount;
      } else {
        lcTotal += feeAmount;
      }
    console.log('[Excel Row]', item.work_item.substring(0, 30), 'fee:', feeAmount, 'provider:', item.provider);

      const dataRow = worksheet.getRow(currentRow);
      
      // Work item with optional indicator
      let workItemDisplay = item.work_item;
      if (item.is_optional) {
        workItemDisplay = `${item.work_item} (Optional)`;
      }
      
      dataRow.values = [
        workItemDisplay,
        item.provider,
        item.lc_firm_name || '',
        feeAmount,
        item.afa_comment || '',
      ];

      // Style the row
      dataRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      dataRow.getCell(2).font = { size: 10, color: { argb: 'FF6B7280' } };
      dataRow.getCell(3).font = { size: 10, color: { argb: 'FF6B7280' } };
      dataRow.getCell(4).numFmt = '#,##0';
      dataRow.getCell(4).alignment = { horizontal: 'right' };
      dataRow.getCell(5).font = { size: 9, color: { argb: 'FF2563EB' }, italic: true };
      dataRow.getCell(5).alignment = { wrapText: true };
      
      // Highlight AFA-adjusted items
      if (item.afa_adjusted) {
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: afaHighlightColor },
          };
        });
      } else if (currentRow % 2 === 0) {
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

      if (item.is_optional) {
        dataRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
        dataRow.getCell(4).font = { italic: true, color: { argb: 'FF6B7280' } };
      }

      // Subtle borders
      dataRow.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'hair', color: { argb: borderColor } },
        };
      });

      currentRow++;
    }

    grandTotal += categoryTotal;

    // Category subtotal
    if (categoryTotal > 0) {
      const subtotalRow = worksheet.getRow(currentRow);
      subtotalRow.values = ['', '', '', categoryTotal, ''];
      subtotalRow.getCell(4).numFmt = '#,##0';
      subtotalRow.getCell(4).alignment = { horizontal: 'right' };
      subtotalRow.font = { bold: true, size: 10, color: { argb: '4B5563' } };
      subtotalRow.getCell(4).border = {
        top: { style: 'thin', color: { argb: borderColor } },
      };
      currentRow++;
    }

    currentRow++;
  }

  // Provider breakdown
  console.log('[Excel Final Totals]', { bmTotal, lcTotal, grandTotal });
  currentRow++;
  const breakdownHeaderRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  breakdownHeaderRow.getCell(1).value = 'Fee Breakdown by Provider';
  breakdownHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: primaryColor } };
  breakdownHeaderRow.height = 24;
  currentRow++;

  // Baker McKenzie fees (already accumulated from rounded line items)
  const bmRow = worksheet.getRow(currentRow);
  bmRow.values = ['Baker McKenzie Fees', '', '', bmTotal, ''];
  bmRow.getCell(4).numFmt = '#,##0';
  bmRow.getCell(4).alignment = { horizontal: 'right' };
  bmRow.getCell(1).font = { size: 11 };
  currentRow++;

  // Local Counsel fees (already accumulated from rounded line items)
  if (lcTotal > 0) {
    const lcRow = worksheet.getRow(currentRow);
    lcRow.values = ['Local Counsel Fees', '', '', lcTotal, ''];
    lcRow.getCell(4).numFmt = '#,##0';
    lcRow.getCell(4).alignment = { horizontal: 'right' };
    lcRow.getCell(1).font = { size: 11 };
    currentRow++;
  }

  // Grand total
  currentRow++;
  const totalRow = worksheet.getRow(currentRow);
  totalRow.values = ['TOTAL FEE PROPOSAL', '', '', grandTotal, ''];
  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(4).alignment = { horizontal: 'right' };
  totalRow.getCell(4).font = { bold: true, size: 13, color: { argb: primaryColor } };
  totalRow.getCell(4).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  };
  totalRow.getCell(1).font = { bold: true, size: 13, color: { argb: primaryColor } };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: primaryColor } },
      bottom: { style: 'double', color: { argb: primaryColor } },
    };
  });
  totalRow.height = 28;

  // Footer with AFA details
  currentRow += 3;
  
  if (filterResult.appliedAFAs.length > 0) {
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const afaFooterHeader = worksheet.getCell(`A${currentRow}`);
    afaFooterHeader.value = 'Fee Arrangement Details:';
    afaFooterHeader.font = { bold: true, size: 10, color: { argb: 'FF6B7280' } };
    currentRow++;

    for (const afa of filterResult.appliedAFAs) {
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
      const afaDetailCell = worksheet.getCell(`A${currentRow}`);
      afaDetailCell.value = `• ${afa.label}: ${afa.description}`;
      afaDetailCell.font = { size: 9, color: { argb: 'FF2563EB' } };
      afaDetailCell.alignment = { wrapText: true };
      currentRow++;
    }
    currentRow++;
  }

  // Standard notes
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const footerCell = worksheet.getCell(`A${currentRow}`);
  footerCell.value = 'Notes:';
  footerCell.font = { bold: true, size: 10, color: { argb: 'FF6B7280' } };
  currentRow++;

  const assumptions = [
    'This fee estimate is provided for discussion purposes and is subject to change.',
    'Fees are based on our current understanding of the scope of work.',
    'Disbursements and out-of-pocket expenses are not included unless otherwise stated.',
    'Local counsel fees are estimates and subject to confirmation by the respective firms.',
  ];

  for (const assumption of assumptions) {
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const noteCell = worksheet.getCell(`A${currentRow}`);
    noteCell.value = `• ${assumption}`;
    noteCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
    noteCell.alignment = { wrapText: true };
    currentRow++;
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
  const safeProposalName = proposalName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `Fee_Proposal_${safeClientName}_${safeProposalName}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
