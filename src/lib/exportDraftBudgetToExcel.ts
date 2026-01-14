import ExcelJS from 'exceljs';
import { DraftLineItem, BUDGET_CATEGORIES, BudgetCategory } from '@/lib/hooks/useBudgetVersions';

interface ExistingBudgetItem {
  work_item: string;
  provider: string;
  fee_amount: number;
  lc_firm_name?: string;
  category?: string;
}

interface ExportDraftBudgetOptions {
  items: DraftLineItem[];
  matterName: string;
  clientName: string;
  currency: string;
  draftName?: string;
  notes?: string;
  /** Conversion rate to apply to all monetary values */
  conversionRate?: number;
  /** Existing budget items for comparison */
  existingItems?: ExistingBudgetItem[];
}

export async function exportDraftBudgetToExcel({
  items,
  matterName,
  clientName,
  currency,
  draftName = 'Draft Budget Proposal',
  notes,
  conversionRate = 1,
  existingItems = [],
}: ExportDraftBudgetOptions): Promise<void> {
  const convert = (value: number) => value * conversionRate;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Baker McKenzie';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Budget Proposal');

  // Check if we have existing items to compare
  const hasComparison = existingItems.length > 0;

  // Set column widths - clean client-facing layout with comparison columns
  if (hasComparison) {
    worksheet.columns = [
      { key: 'workItem', width: 45 },
      { key: 'provider', width: 18 },
      { key: 'lcFirmName', width: 22 },
      { key: 'existingFee', width: 16 },
      { key: 'proposedFee', width: 16 },
      { key: 'change', width: 14 },
    ];
  } else {
    worksheet.columns = [
      { key: 'workItem', width: 50 },
      { key: 'provider', width: 20 },
      { key: 'lcFirmName', width: 25 },
      { key: 'feeAmount', width: 18 },
      { key: 'notes', width: 30 },
    ];
  }

  // Professional color palette - Baker McKenzie inspired
  const primaryColor = 'FF1A1A2E'; // Dark navy
  const accentColor = 'FF8B0000'; // Deep red
  const lightGray = 'FFF8F9FA';
  const borderColor = 'FFE5E7EB';
  const changeUpColor = 'FFDC2626'; // Red for increases
  const changeDownColor = 'FF059669'; // Green for decreases
  const newItemColor = 'FF3B82F6'; // Blue for new items

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
  const lastCol = hasComparison ? 'F' : 'E';
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = hasComparison ? 'Proposed Budget Amendment' : 'Fee Estimate';
  titleCell.font = titleFont;
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  worksheet.getRow(1).height = 36;

  // Client info
  worksheet.mergeCells(`A2:${lastCol}2`);
  const clientCell = worksheet.getCell('A2');
  clientCell.value = clientName;
  clientCell.font = { ...subtitleFont, bold: true, size: 14 };

  // Matter info
  worksheet.mergeCells(`A3:${lastCol}3`);
  const matterCell = worksheet.getCell('A3');
  matterCell.value = matterName;
  matterCell.font = subtitleFont;

  // Draft info with date (only add date if not already in draftName)
  worksheet.mergeCells(`A4:${lastCol}4`);
  const draftCell = worksheet.getCell('A4');
  const hasDateInName = /\d{1,2}\s+\w+\s+\d{4}/.test(draftName);
  draftCell.value = hasDateInName 
    ? draftName 
    : `${draftName} | ${new Date().toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })}`;
  draftCell.font = { ...subtitleFont, italic: true, color: { argb: 'FF6B7280' } };

  // Add notes if provided
  let currentRow = 5;
  if (notes) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
    const notesCell = worksheet.getCell(`A${currentRow}`);
    notesCell.value = notes;
    notesCell.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    notesCell.alignment = { wrapText: true };
    currentRow++;
  }

  // Disclaimer/Draft watermark row
  worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
  const disclaimerCell = worksheet.getCell(`A${currentRow}`);
  disclaimerCell.value = 'DRAFT - FOR DISCUSSION PURPOSES ONLY';
  disclaimerCell.font = { bold: true, size: 10, color: { argb: accentColor } };
  disclaimerCell.alignment = { horizontal: 'center' };
  currentRow++;

  // Empty row for spacing
  worksheet.getRow(currentRow).height = 15;
  currentRow++;

  // Column headers
  const headerRow = worksheet.getRow(currentRow);
  if (hasComparison) {
    headerRow.values = [
      'Scope of Work',
      'Provider',
      'Local Counsel',
      `Current (${currency})`,
      `Proposed (${currency})`,
      'Change',
    ];
    [4, 5, 6].forEach(col => {
      headerRow.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  } else {
    headerRow.values = [
      'Scope of Work',
      'Provider',
      'Local Counsel',
      `Fee Estimate (${currency})`,
      'Remarks',
    ];
    headerRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  }
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    if (!cell.alignment) {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
    }
    cell.border = {
      bottom: { style: 'medium', color: { argb: primaryColor } },
    };
  });
  headerRow.height = 28;
  
  // Set freeze pane to freeze at the header row (currentRow is now the row after header)
  const headerRowNumber = currentRow;
  worksheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  
  currentRow++;

  // Create lookup map for existing items
  const existingItemsMap = new Map<string, ExistingBudgetItem>();
  existingItems.forEach(item => {
    // Create a normalized key for matching
    const key = `${item.work_item.toLowerCase().trim()}|${item.provider}|${item.lc_firm_name || ''}`;
    existingItemsMap.set(key, item);
  });

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

  let grandTotalExisting = 0;
  let grandTotalProposed = 0;
  let bmTotalProposed = 0;
  let lcTotalProposed = 0;

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
    const catHeaderRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
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

    let categoryTotalExisting = 0;
    let categoryTotalProposed = 0;

    // Add items
    for (const item of categoryItems) {
      // Skip optional items that are not included
      if (item.is_optional && item.is_included === false) continue;
      
      const proposedFee = convert(item.fee_amount || 0);
      
      if (item.provider === 'Baker McKenzie') {
        bmTotalProposed += proposedFee;
      } else {
        lcTotalProposed += proposedFee;
      }

      const dataRow = worksheet.getRow(currentRow);
      
      // Format work item with optional indicator
      let workItemDisplay = item.work_item;
      if (item.is_optional) {
        workItemDisplay = `${item.work_item} (Optional)`;
      }
      
      if (hasComparison) {
        // Find matching existing item
        const key = `${item.work_item.toLowerCase().trim()}|${item.provider}|${item.lc_firm_name || ''}`;
        const existingItem = existingItemsMap.get(key);
        const existingFee = existingItem ? convert(existingItem.fee_amount || 0) : 0;
        const isNewItem = !existingItem;
        const change = proposedFee - existingFee;
        const hasChange = Math.abs(change) > 0.01;
        
        categoryTotalExisting += existingFee;
        categoryTotalProposed += proposedFee;
        
        dataRow.values = [
          workItemDisplay,
          item.provider,
          item.lc_firm_name || '',
          existingFee || '',
          // Only show proposed fee if it's different from existing OR if it's a new item
          (hasChange || isNewItem) ? proposedFee : '',
          hasChange || isNewItem ? change : '',
        ];

        // Style the row
        dataRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        dataRow.getCell(2).font = { size: 10, color: { argb: 'FF6B7280' } };
        dataRow.getCell(3).font = { size: 10, color: { argb: 'FF6B7280' } };
        
        // Format existing fee
        if (existingFee > 0) {
          dataRow.getCell(4).numFmt = '#,##0';
          dataRow.getCell(4).alignment = { horizontal: 'right' };
          dataRow.getCell(4).font = { size: 10, color: { argb: 'FF6B7280' } };
        }
        
        // Format proposed fee - only if there's a change or it's a new item
        if (hasChange || isNewItem) {
          dataRow.getCell(5).numFmt = '#,##0';
          dataRow.getCell(5).alignment = { horizontal: 'right' };
          dataRow.getCell(5).font = { size: 11, bold: true };
        }
        
        // Format change column
        if (hasChange || isNewItem) {
          dataRow.getCell(6).numFmt = '+#,##0;-#,##0;0';
          dataRow.getCell(6).alignment = { horizontal: 'right' };
          if (isNewItem) {
            dataRow.getCell(6).font = { size: 10, color: { argb: newItemColor }, bold: true };
            dataRow.getCell(1).font = { color: { argb: newItemColor } };
            // Add "NEW" indicator
            dataRow.getCell(6).value = 'NEW';
          } else if (change > 0) {
            dataRow.getCell(6).font = { size: 10, color: { argb: changeUpColor }, bold: true };
          } else {
            dataRow.getCell(6).font = { size: 10, color: { argb: changeDownColor }, bold: true };
          }
        }
        
        if (item.is_optional) {
          dataRow.getCell(1).font = { ...dataRow.getCell(1).font, italic: true };
        }
      } else {
        categoryTotalProposed += proposedFee;
        
        dataRow.values = [
          workItemDisplay,
          item.provider,
          item.lc_firm_name || '',
          proposedFee,
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
      }

      // Alternate row colors
      if (currentRow % 2 === 0) {
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

      currentRow++;
    }

    grandTotalExisting += categoryTotalExisting;
    grandTotalProposed += categoryTotalProposed;

    // Category subtotal
    if (categoryTotalProposed > 0) {
      const subtotalRow = worksheet.getRow(currentRow);
      if (hasComparison) {
        const categoryChange = categoryTotalProposed - categoryTotalExisting;
        subtotalRow.values = [
          '',
          '',
          '',
          categoryTotalExisting > 0 ? categoryTotalExisting : '',
          categoryTotalProposed,
          Math.abs(categoryChange) > 0.01 ? categoryChange : '',
        ];
        [4, 5].forEach(col => {
          if (subtotalRow.getCell(col).value) {
            subtotalRow.getCell(col).numFmt = '#,##0';
            subtotalRow.getCell(col).alignment = { horizontal: 'right' };
          }
        });
        if (Math.abs(categoryChange) > 0.01) {
          subtotalRow.getCell(6).numFmt = '+#,##0;-#,##0;0';
          subtotalRow.getCell(6).alignment = { horizontal: 'right' };
          subtotalRow.getCell(6).font = { 
            bold: true, 
            size: 10, 
            color: { argb: categoryChange > 0 ? changeUpColor : changeDownColor } 
          };
        }
      } else {
        subtotalRow.values = ['', '', '', categoryTotalProposed, ''];
        subtotalRow.getCell(4).numFmt = '#,##0';
        subtotalRow.getCell(4).alignment = { horizontal: 'right' };
      }
      subtotalRow.font = { bold: true, size: 10, color: { argb: '4B5563' } };
      subtotalRow.getCell(4).border = {
        top: { style: 'thin', color: { argb: borderColor } },
      };
      currentRow++;
    }

    // Spacing between categories
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
  if (hasComparison) {
    const existingBmTotal = existingItems
      .filter(i => i.provider === 'Baker McKenzie')
      .reduce((sum, i) => sum + convert(i.fee_amount || 0), 0);
    bmRow.values = ['Baker McKenzie Fees', '', '', existingBmTotal > 0 ? existingBmTotal : '', bmTotalProposed, ''];
    bmRow.getCell(4).numFmt = '#,##0';
    bmRow.getCell(5).numFmt = '#,##0';
    [4, 5].forEach(col => bmRow.getCell(col).alignment = { horizontal: 'right' });
  } else {
    bmRow.values = ['Baker McKenzie Fees', '', '', bmTotalProposed, ''];
    bmRow.getCell(4).numFmt = '#,##0';
    bmRow.getCell(4).alignment = { horizontal: 'right' };
  }
  bmRow.getCell(1).font = { size: 11 };
  currentRow++;

  // Local Counsel fees
  if (lcTotalProposed > 0) {
    const lcRow = worksheet.getRow(currentRow);
    if (hasComparison) {
      const existingLcTotal = existingItems
        .filter(i => i.provider === 'Local Counsel')
        .reduce((sum, i) => sum + convert(i.fee_amount || 0), 0);
      lcRow.values = ['Local Counsel Fees', '', '', existingLcTotal > 0 ? existingLcTotal : '', lcTotalProposed, ''];
      lcRow.getCell(4).numFmt = '#,##0';
      lcRow.getCell(5).numFmt = '#,##0';
      [4, 5].forEach(col => lcRow.getCell(col).alignment = { horizontal: 'right' });
    } else {
      lcRow.values = ['Local Counsel Fees', '', '', lcTotalProposed, ''];
      lcRow.getCell(4).numFmt = '#,##0';
      lcRow.getCell(4).alignment = { horizontal: 'right' };
    }
    lcRow.getCell(1).font = { size: 11 };
    currentRow++;
  }

  // Grand total row
  currentRow++;
  const totalRow = worksheet.getRow(currentRow);
  const grandChange = grandTotalProposed - grandTotalExisting;
  
  if (hasComparison) {
    totalRow.values = [
      'TOTAL FEE ESTIMATE',
      '',
      '',
      grandTotalExisting > 0 ? grandTotalExisting : '',
      grandTotalProposed,
      Math.abs(grandChange) > 0.01 ? grandChange : '',
    ];
    [4, 5].forEach(col => {
      if (totalRow.getCell(col).value) {
        totalRow.getCell(col).numFmt = '#,##0';
        totalRow.getCell(col).alignment = { horizontal: 'right' };
        totalRow.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
      }
    });
    if (Math.abs(grandChange) > 0.01) {
      totalRow.getCell(6).numFmt = '+#,##0;-#,##0;0';
      totalRow.getCell(6).alignment = { horizontal: 'right' };
      totalRow.getCell(6).font = { 
        bold: true, 
        size: 13, 
        color: { argb: grandChange > 0 ? changeUpColor : changeDownColor } 
      };
      totalRow.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' },
      };
    }
    totalRow.getCell(4).font = { size: 12, color: { argb: 'FF6B7280' } };
    totalRow.getCell(5).font = { bold: true, size: 13, color: { argb: primaryColor } };
  } else {
    totalRow.values = ['TOTAL FEE ESTIMATE', '', '', grandTotalProposed, ''];
    totalRow.getCell(4).numFmt = '#,##0';
    totalRow.getCell(4).alignment = { horizontal: 'right' };
    totalRow.getCell(4).font = { bold: true, size: 13, color: { argb: primaryColor } };
    totalRow.getCell(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
  }
  
  totalRow.getCell(1).font = { bold: true, size: 13, color: { argb: primaryColor } };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: primaryColor } },
      bottom: { style: 'double', color: { argb: primaryColor } },
    };
  });
  totalRow.height = 28;

  // Footer with assumptions/notes
  currentRow += 3;
  worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
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
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`);
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
  const safeMatterName = matterName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `Fee_Estimate_${safeClientName}_${safeMatterName}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
