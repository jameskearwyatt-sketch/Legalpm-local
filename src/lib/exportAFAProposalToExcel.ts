/**
 * Export pricing proposal to Excel with AFA (Alternative Fee Arrangement) filters applied.
 * This generates client-facing proposals with adjusted figures and explanatory comments.
 */

import ExcelJS from 'exceljs';
import { DraftProposalItem, BUDGET_CATEGORIES } from '@/lib/hooks/usePricingProposals';
import { ProposalAFA, AFA_TYPE_LABELS } from '@/lib/hooks/useProposalAFAs';
import { applyAFAFilters, AFAFilteredItem } from '@/lib/afaFilterUtils';

interface ExportAFAProposalOptions {
  items: DraftProposalItem[];
  enabledAFAs: ProposalAFA[];
  proposalName: string;
  clientName: string;
  currency: string;
  baselineTotal: number;
  notes?: string;
}

export async function exportAFAProposalToExcel({
  items,
  enabledAFAs,
  proposalName,
  clientName,
  currency,
  baselineTotal,
  notes,
}: ExportAFAProposalOptions): Promise<void> {
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
  
  // Apply AFA filters to get adjusted items
  const filterResult = applyAFAFilters(items, enabledAFAs, baselineTotal, currencySymbol);
  
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

  // Column widths
  worksheet.columns = [
    { key: 'workItem', width: 45 },
    { key: 'provider', width: 18 },
    { key: 'lcFirmName', width: 20 },
    { key: 'feeAmount', width: 16 },
    { key: 'comments', width: 40 },
  ];

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

  // Title section
  worksheet.mergeCells('A1:E1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'Fee Proposal';
  titleCell.font = titleFont;
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 36;

  // Client info
  worksheet.mergeCells('A2:E2');
  const clientCell = worksheet.getCell('A2');
  clientCell.value = clientName;
  clientCell.font = { ...subtitleFont, bold: true, size: 14 };

  // Proposal info
  worksheet.mergeCells('A3:E3');
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
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const afaSummaryHeader = worksheet.getCell(`A${currentRow}`);
    afaSummaryHeader.value = 'Fee Arrangement';
    afaSummaryHeader.font = { bold: true, size: 11, color: { argb: primaryColor } };
    currentRow++;

    // Add global comment if present
    if (filterResult.globalComment) {
      worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
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
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const notesCell = worksheet.getCell(`A${currentRow}`);
    notesCell.value = notes;
    notesCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    notesCell.alignment = { wrapText: true };
    currentRow++;
  }

  // Draft watermark
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const disclaimerCell = worksheet.getCell(`A${currentRow}`);
  disclaimerCell.value = 'DRAFT - FOR DISCUSSION PURPOSES ONLY';
  disclaimerCell.font = { bold: true, size: 10, color: { argb: accentColor } };
  disclaimerCell.alignment = { horizontal: 'center' };
  currentRow += 2;

  // Column headers
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = [
    'Scope of Work',
    'Provider',
    'Local Counsel',
    `Fee (${currency})`,
    'Notes',
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
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
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

    // Add items
    for (const item of categoryItems) {
      const feeAmount = item.fee_amount || 0;
      categoryTotal += feeAmount;
      
      if (item.provider === 'Baker McKenzie') {
        bmTotal += feeAmount;
      } else {
        lcTotal += feeAmount;
      }

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
  currentRow++;
  const breakdownHeaderRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  breakdownHeaderRow.getCell(1).value = 'Fee Breakdown by Provider';
  breakdownHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: primaryColor } };
  breakdownHeaderRow.height = 24;
  currentRow++;

  // Baker McKenzie fees
  const bmRow = worksheet.getRow(currentRow);
  bmRow.values = ['Baker McKenzie Fees', '', '', bmTotal, ''];
  bmRow.getCell(4).numFmt = '#,##0';
  bmRow.getCell(4).alignment = { horizontal: 'right' };
  bmRow.getCell(1).font = { size: 11 };
  currentRow++;

  // Local Counsel fees
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
