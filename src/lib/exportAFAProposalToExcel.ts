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
import { DEPT_COLORS, getDeptColorIndex } from '@/components/pricing/InternalInputDeptSelector';
import { GroupedAssumptionNarratives, EXPORT_CATEGORY_LABELS, CATEGORY_ORDER } from '@/components/pricing/ScopeAssumptionsTab';

/**
 * Dynamic rounding based on value size:
 * - Values < 10,000: round to nearest 100
 * - Values >= 10,000: round to nearest 1,000
 */
function smartRound(value: number): number {
  if (Math.abs(value) < 10000) {
    return Math.round(value / 100) * 100;
  }
  return Math.round(value / 1000) * 1000;
}

interface WorkPhase {
  id: string;
  name: string;
  is_included?: boolean;
}

interface TeamMemberSummary {
  key: string;
  label: string;
  rate: number;
  afaRate?: number | null;
  hours: number;
  revenue: number;
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
  // Scope assumptions narratives - now supports grouped format
  scopeAssumptionNarratives?: string[];
  groupedAssumptionNarratives?: GroupedAssumptionNarratives;
  // Work phases for organizing items
  workPhases?: WorkPhase[];
  // Internal input department highlighting
  includeInputDeptHighlighting?: boolean;
  existingInputDepts?: string[];
  // Team member breakdown
  includeTeamBreakdown?: boolean;
  teamMembers?: TeamMemberSummary[];
  teamCurrency?: string;
  hideUpperAndPcSum?: boolean;
  afaBlendedRate?: number | null;
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
  scopeAssumptionNarratives,
  groupedAssumptionNarratives,
  workPhases,
  includeInputDeptHighlighting = false,
  existingInputDepts = [],
  includeTeamBreakdown = false,
  teamMembers: teamMemberData = [],
  teamCurrency,
  hideUpperAndPcSum = false,
  afaBlendedRate = null,
}: ExportAFAProposalOptions): Promise<void> {
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
  
  // Determine which columns to export
  const exportLower = hideUpperAndPcSum ? false : (excelExportFigures?.lower ?? false);
  const exportMidpoint = hideUpperAndPcSum ? false : (excelExportFigures?.midpoint ?? true);
  const exportUpper = hideUpperAndPcSum ? false : (excelExportFigures?.upper ?? false);
  
  // Calculate how many fee columns we need
  const feeColumnCount = [exportLower, exportMidpoint, exportUpper].filter(Boolean).length;
  
  // Use afaBaseFigure for AFA calculations, default to midpoint
  const baseFigure: FigureType = afaBaseFigure || 'midpoint';
  
  // Calculate baseline total using the selected figure type (with multipliers)
  const calculatedBaselineTotal = items.reduce((sum, item) => {
    const mult = (item.is_multiplied && item.multiplier_qty) ? item.multiplier_qty : 1;
    return sum + getItemFeeByFigureType(item, baseFigure) * mult;
  }, 0);
  
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
  // Item # column first, then merged Provider column (shows BM or LC firm name/country)
  const columns: { key: string; width: number }[] = [
    { key: 'itemNumber', width: 8 },
    { key: 'workItem', width: 35 },
    { key: 'detail', width: 80 },
    { key: 'provider', width: 22 },
  ];
  
  if (exportLower) columns.push({ key: 'feeLower', width: 16 });
  if (exportMidpoint) columns.push({ key: 'feeMidpoint', width: 16 });
  if (exportUpper) columns.push({ key: 'feeUpper', width: 16 });
  
  if (!hideUpperAndPcSum) {
    columns.push({ key: 'pcSum', width: 10 }); // PC Sum column after fee columns
  }
  
  // Add Internal Input column if highlighting is enabled
  if (includeInputDeptHighlighting) {
    columns.push({ key: 'internalInput', width: 20 });
  }
  
  columns.push({ key: 'comments', width: 35 });
  
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
  titleCell.value = hideUpperAndPcSum ? 'Scope Proposal' : 'Fee Proposal';
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
  proposalCell.font = { ...subtitleFont, color: { argb: 'FF6B7280' } };

  let currentRow = 4;

  // Add AFA summary if any AFAs are applied - make it visually prominent
  if (filterResult.appliedAFAs.length > 0) {
    currentRow++;
    
    // AFA section with prominent styling
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const afaSummaryHeader = worksheet.getCell(`A${currentRow}`);
    afaSummaryHeader.value = '💼 Fee Arrangement';
    afaSummaryHeader.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    afaSummaryHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Strong blue background
    };
    afaSummaryHeader.alignment = { vertical: 'middle' };
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    // Add each AFA as a prominent line (always show the AFA type + description)
    for (const afa of filterResult.appliedAFAs) {
      worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
      const afaCell = worksheet.getCell(`A${currentRow}`);
      afaCell.value = `${afa.label}: ${afa.description}`;
      afaCell.font = { bold: true, size: 11, color: { argb: 'FF1E40AF' } };
      afaCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }, // Light blue background
      };
      afaCell.alignment = { wrapText: true, vertical: 'middle' };
      afaCell.border = {
        left: { style: 'thick', color: { argb: 'FF2563EB' } },
      };
      worksheet.getRow(currentRow).height = 24;
      currentRow++;
      
      // Check if user has opted to include client narrative for this AFA
      // Find the original AFA object to check is_selected_for_export
      const originalAfa = enabledAFAs.find(a => a.afa_type === afa.type);
      if (originalAfa?.is_selected_for_export && originalAfa?.client_narrative?.trim()) {
        worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
        const narrativeCell = worksheet.getCell(`A${currentRow}`);
        narrativeCell.value = originalAfa.client_narrative.trim();
        narrativeCell.font = { size: 10, color: { argb: 'FF374151' } };
        narrativeCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F9FF' }, // Very light blue
        };
        narrativeCell.alignment = { wrapText: true, vertical: 'middle' };
        narrativeCell.border = {
          left: { style: 'thick', color: { argb: 'FF2563EB' } },
        };
        worksheet.getRow(currentRow).height = 24;
        currentRow++;
      }
    }
    currentRow++;
  }

  // Scope Assumptions section - grouped by category with subheadings
  const hasGroupedAssumptions = groupedAssumptionNarratives && Object.keys(groupedAssumptionNarratives).length > 0;
  const hasFlatAssumptions = scopeAssumptionNarratives && scopeAssumptionNarratives.length > 0;
  
  if (hasGroupedAssumptions || hasFlatAssumptions) {
    // Main header
    worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
    const assumptionsHeader = worksheet.getCell(`A${currentRow}`);
    assumptionsHeader.value = '📋 Key Assumptions';
    assumptionsHeader.font = { bold: true, size: 12, color: { argb: 'FF374151' } };
    assumptionsHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    worksheet.getRow(currentRow).height = 24;
    currentRow++;

    // Helper to render a single narrative row
    const renderNarrativeRow = (narrative: string) => {
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
      const narrativeCell = worksheet.getCell(`A${currentRow}`);
      narrativeCell.value = `• ${narrative}`;
      narrativeCell.font = { size: 10, color: { argb: 'FF4B5563' } };
      narrativeCell.alignment = { wrapText: true, vertical: 'top' };
      
      // Columns A+B+C widths: 8+35+80 = 123 units, ~90 chars per line at size 10
      const charsPerLine = 90;
      const textLength = narrative.length + 2; // +2 for bullet
      const estimatedLines = Math.ceil(textLength / charsPerLine);
      
      // Base height: 15 points for single line (compact)
      // Additional lines: 14 points each (just enough for wrapped text)
      const rowHeight = estimatedLines === 1 ? 15 : (15 + (estimatedLines - 1) * 14);
      worksheet.getRow(currentRow).height = rowHeight;
      currentRow++;
    };

    // Helper to render category subheading
    const renderCategorySubheading = (categoryLabel: string) => {
      worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
      const subheadingCell = worksheet.getCell(`A${currentRow}`);
      subheadingCell.value = categoryLabel;
      subheadingCell.font = { bold: true, size: 10, color: { argb: 'FF1F2937' } };
      subheadingCell.alignment = { vertical: 'middle' };
      worksheet.getRow(currentRow).height = 20;
      currentRow++;
    };

    if (hasGroupedAssumptions && groupedAssumptionNarratives) {
      // Render grouped assumptions with category subheadings
      for (const category of CATEGORY_ORDER) {
        const narratives = groupedAssumptionNarratives[category];
        if (!narratives || narratives.length === 0) continue;
        
        const categoryLabel = EXPORT_CATEGORY_LABELS[category] || category;
        renderCategorySubheading(categoryLabel);
        
        for (const narrative of narratives) {
          renderNarrativeRow(narrative);
        }
      }
    } else if (hasFlatAssumptions && scopeAssumptionNarratives) {
      // Fallback to flat list if no grouped data
      for (const narrative of scopeAssumptionNarratives) {
        renderNarrativeRow(narrative);
      }
    }
    currentRow++;
  }

  // Notes if provided
  if (notes) {
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const notesCell = worksheet.getCell(`A${currentRow}`);
    notesCell.value = notes;
    notesCell.font = { size: 10, color: { argb: 'FF6B7280' } };
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

  // Build dynamic header values - includes Item #, Detail column and PC Sum
  const headerValues: string[] = ['Item #', 'Scope of Work', 'Detail', 'Provider'];
  if (exportLower) headerValues.push(`Lower Range (${currency})`);
  if (exportMidpoint) headerValues.push(`Midpoint (${currency})`);
  if (exportUpper) headerValues.push(`Estimate (${currency})`);
  if (!hideUpperAndPcSum) headerValues.push('PC Sum?');
  
  // Add Internal Input header if highlighting is enabled
  if (includeInputDeptHighlighting) {
    headerValues.push('BM Input From');
  }
  
  headerValues.push('Notes');
  
  // Track which column indices are fee columns (for right-alignment)
  // With item # and detail column: itemNumber(1), workItem(2), detail(3), provider(4), fee columns start at 5
  const feeColumnIndices: number[] = [];
  let colIdx = 5; // Fee columns now start at column 5
  if (exportLower) feeColumnIndices.push(colIdx++);
  if (exportMidpoint) feeColumnIndices.push(colIdx++);
  if (exportUpper) feeColumnIndices.push(colIdx++);
  const pcSumColumnIndex = !hideUpperAndPcSum ? colIdx++ : -1; // PC Sum column comes after fee columns
  const internalInputColumnIndex = includeInputDeptHighlighting ? colIdx++ : -1;
  const notesColumnIndex = colIdx;
  
  // Sequential item numbering counter
  let itemNumber = 1;

  // Column headers
  const headerRow = worksheet.getRow(currentRow);
  headerRow.values = headerValues;
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    // Center align Item # (col 1), Provider (col 4), Fee columns, and PC Sum column
    const isCenteredColumn = colNumber === 1 || colNumber === 4 || feeColumnIndices.includes(colNumber) || colNumber === pcSumColumnIndex;
    cell.alignment = { horizontal: isCenteredColumn ? 'center' : 'left', vertical: 'middle' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: primaryColor } },
    };
  });
  headerRow.height = 28;
  
  // No freeze panes - allow normal scrolling
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

  // Get valid items for export
  const validItems = filterResult.items.filter(item => 
    item.work_item.trim() !== '' && (item.is_included !== false || !item.is_optional)
  );

  let grandTotal = 0;
  let bmTotal = 0;
  let lcTotal = 0;
  let hasPcSumItems = false; // Track if any items have PC Sum checked

  // Helper to render items grouped by category
  const renderCategoryGroup = (categoryItems: AFAFilteredItem[], category: string) => {
    if (categoryItems.length === 0) return;

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

    // Add items
    for (const item of categoryItems) {
      const mult = (item.is_multiplied && item.multiplier_qty && item.multiplier_qty > 1) ? item.multiplier_qty : 1;
      const feeAmount = (item.fee_amount || 0) * mult;
      categoryTotal += feeAmount;
      grandTotal += feeAmount;
      
      if (item.provider === 'Baker McKenzie') {
        bmTotal += feeAmount;
      } else {
        lcTotal += feeAmount;
      }
      
      // Track PC Sum items
      if (item.is_pc_sum) {
        hasPcSumItems = true;
      }

      const dataRow = worksheet.getRow(currentRow);
      
      // Work item with optional indicator
      let workItemDisplay = item.work_item;
      if (item.is_optional) {
        workItemDisplay = `${item.work_item} (Optional)`;
      }
      
      // Merged provider column: show BM or LC firm name/country
      let providerDisplay: string = item.provider;
      if (item.provider === 'Local Counsel') {
        if (item.lc_firm_name) {
          providerDisplay = item.lc_firm_name;
        } else if (item.lc_country) {
          providerDisplay = `Local Counsel (${item.lc_country})`;
        }
      }
      
      // Build detail with multiplier narrative
      let detailDisplay = item.detail || '';
      if (mult > 1) {
        const multNarrative = `For the purposes of this estimate, we have assumed ${mult} instances of this item.`;
        detailDisplay = detailDisplay ? `${detailDisplay}\n\n${multNarrative}` : multNarrative;
      }
      
      // Build row values dynamically based on columns (Item # is first column)
      const rowValues: (string | number)[] = [
        itemNumber++, // Sequential item number
        workItemDisplay,
        detailDisplay,
        providerDisplay,
      ];
      if (exportLower) rowValues.push(feeAmount); // TODO: use lower fee if available
      if (exportMidpoint) rowValues.push(feeAmount);
      if (exportUpper) rowValues.push(feeAmount); // TODO: use upper fee if available
      if (!hideUpperAndPcSum) {
        rowValues.push(item.is_pc_sum ? 'Yes' : '');
      }
      
      // Add internal input column if enabled
      if (includeInputDeptHighlighting) {
        rowValues.push(item.internal_input_dept || '');
      }
      
      rowValues.push(hideUpperAndPcSum ? '' : (item.afa_comment || ''));
      
      dataRow.values = rowValues;

      // Style the row - Item # is now column 1, work item is column 2, etc.
      dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      dataRow.getCell(1).font = { size: 10, color: { argb: 'FF6B7280' } };
      dataRow.getCell(2).alignment = { wrapText: true, vertical: 'top' };
      dataRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
      dataRow.getCell(3).font = { size: 10 };
      dataRow.getCell(4).font = { size: 10, color: { argb: 'FF6B7280' } };
      dataRow.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      // Style fee columns (only if they exist)
      for (const fci of feeColumnIndices) {
        dataRow.getCell(fci).numFmt = '#,##0';
        dataRow.getCell(fci).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (pcSumColumnIndex > 0) {
        dataRow.getCell(pcSumColumnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        if (item.is_pc_sum) {
          dataRow.getCell(pcSumColumnIndex).font = { size: 10, color: { argb: 'FF7C3AED' }, bold: true };
        }
      }
      
      // Style internal input column if present
      if (includeInputDeptHighlighting && internalInputColumnIndex > 0) {
        dataRow.getCell(internalInputColumnIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        dataRow.getCell(internalInputColumnIndex).font = { size: 10, bold: !!item.internal_input_dept };
      }
      
      // Style notes column
      dataRow.getCell(notesColumnIndex).font = { size: 9, color: { argb: 'FF2563EB' } };
      dataRow.getCell(notesColumnIndex).alignment = { wrapText: true };
      
      // Apply row highlighting based on internal input dept (takes priority over other highlighting)
      if (includeInputDeptHighlighting && item.internal_input_dept && existingInputDepts.length > 0) {
        const colorIndex = getDeptColorIndex(item.internal_input_dept, existingInputDepts);
        const deptColor = DEPT_COLORS[colorIndex];
        dataRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: deptColor.excelBg },
          };
        });
      } else if (item.afa_adjusted) {
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
        dataRow.getCell(2).font = { color: { argb: 'FF6B7280' } };
        dataRow.getCell(notesColumnIndex).font = { color: { argb: 'FF6B7280' } };
      }

      // Subtle borders
      dataRow.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'hair', color: { argb: borderColor } },
        };
      });

      currentRow++;

      // If assumption-linked with alt pricing, add an indented amber row showing impact (only for fee proposals)
      if (!hideUpperAndPcSum && item.assumption_linked && (item.alt_fee_upper || item.alt_fee_lower)) {
        const altFee = smartRound(item.alt_fee_upper || item.alt_fee_lower || 0);
        const baseFee = smartRound(feeAmount);
        const delta = altFee - baseFee;
        const altRow = worksheet.getRow(currentRow);
        const altRowValues: (string | number)[] = [
          '',
          `  ↳ If assumption not true`,
          item.assumption_text || '',
          '',
          altFee,
          '',
        ];
        if (includeInputDeptHighlighting) altRowValues.push('');
        altRowValues.push(delta > 0 ? `+${smartRound(delta).toLocaleString()} increase` : `${smartRound(delta).toLocaleString()} change`);
        altRow.values = altRowValues;
        altRow.getCell(2).font = { size: 9, color: { argb: 'FFB45309' } };
        altRow.getCell(3).font = { size: 9, color: { argb: 'FF92400E' } };
        altRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        altRow.getCell(5).numFmt = '#,##0';
        altRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        altRow.getCell(5).font = { size: 9, bold: true, color: { argb: 'FFB45309' } };
        altRow.getCell(notesColumnIndex).font = { size: 9, color: { argb: 'FFB45309' } };
        altRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFBEB' }, // Amber-50
          };
          cell.border = {
            bottom: { style: 'hair', color: { argb: borderColor } },
          };
        });
        currentRow++;
      }
    }

    // Category subtotal (only for fee proposals)
    if (!hideUpperAndPcSum && categoryTotal > 0) {
      const subtotalRow = worksheet.getRow(currentRow);
      subtotalRow.values = ['', '', '', '', categoryTotal, '', ''];
      subtotalRow.getCell(5).numFmt = '#,##0';
      subtotalRow.getCell(5).alignment = { horizontal: 'center' };
      subtotalRow.font = { bold: true, size: 10, color: { argb: '4B5563' } };
      subtotalRow.getCell(5).border = {
        top: { style: 'thin', color: { argb: borderColor } },
      };
      currentRow++;
    }

    currentRow++;
  };

  // Check if we have phases
  const hasPhases = workPhases && workPhases.length > 0;
  
  if (hasPhases) {
    // Keep phases in their original order (as defined in the UI)
    const sortedPhases = [...workPhases];
    
    // Process each phase
    for (const phase of sortedPhases) {
      // Get items in this phase
      const phaseItems = validItems.filter(item => item.phase_id === phase.id);
      if (phaseItems.length === 0) continue;
      
      // Phase header
      const phaseHeaderRow = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
      phaseHeaderRow.getCell(1).value = `📁 ${phase.name}`;
      phaseHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      phaseHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4B5563' }, // Dark gray for phase headers
      };
      phaseHeaderRow.getCell(1).alignment = { vertical: 'middle' };
      phaseHeaderRow.height = 26;
      currentRow++;
      
      // Group phase items by category
      const groupedByCategory: Record<string, AFAFilteredItem[]> = {};
      BUDGET_CATEGORIES.forEach((cat) => {
        groupedByCategory[cat] = [];
      });
      
      phaseItems.forEach((item) => {
        let category = item.category || 'Other';
        const isKnownCategory = BUDGET_CATEGORIES.includes(category as typeof BUDGET_CATEGORIES[number]);
        if (!isKnownCategory) {
          category = 'Other';
        }
        groupedByCategory[category].push(item);
      });
      
      // Render categories within this phase
      for (const category of BUDGET_CATEGORIES) {
        renderCategoryGroup(groupedByCategory[category], category);
      }
    }
    
    // Also handle unassigned items (no phase_id)
    const unassignedItems = validItems.filter(item => !item.phase_id);
    if (unassignedItems.length > 0) {
      // Unassigned header
      const unassignedHeaderRow = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
      unassignedHeaderRow.getCell(1).value = '📁 Other Work Items';
      unassignedHeaderRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      unassignedHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF6B7280' },
      };
      unassignedHeaderRow.getCell(1).alignment = { vertical: 'middle' };
      unassignedHeaderRow.height = 26;
      currentRow++;
      
      // Group unassigned by category
      const groupedByCategory: Record<string, AFAFilteredItem[]> = {};
      BUDGET_CATEGORIES.forEach((cat) => {
        groupedByCategory[cat] = [];
      });
      
      unassignedItems.forEach((item) => {
        let category = item.category || 'Other';
        const isKnownCategory = BUDGET_CATEGORIES.includes(category as typeof BUDGET_CATEGORIES[number]);
        if (!isKnownCategory) {
          category = 'Other';
        }
        groupedByCategory[category].push(item);
      });
      
      for (const category of BUDGET_CATEGORIES) {
        renderCategoryGroup(groupedByCategory[category], category);
      }
    }
  } else {
    // No phases - group all items by category only (original behavior)
    const groupedItems: Record<string, AFAFilteredItem[]> = {};
    BUDGET_CATEGORIES.forEach((cat) => {
      groupedItems[cat] = [];
    });

    validItems.forEach((item) => {
      let category = item.category || 'Other';
      const isKnownCategory = BUDGET_CATEGORIES.includes(category as typeof BUDGET_CATEGORIES[number]);
      if (!isKnownCategory) {
        category = 'Other';
      }
      groupedItems[category].push(item);
    });

    // Process each category
    for (const category of BUDGET_CATEGORIES) {
      renderCategoryGroup(groupedItems[category], category);
    }
  }

  // Provider breakdown, totals, AFA summary, alt pricing - only for fee proposals
  if (!hideUpperAndPcSum) {
    // Provider breakdown
    currentRow++;
    const breakdownHeaderRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    breakdownHeaderRow.getCell(1).value = 'Fee Breakdown by Provider';
    breakdownHeaderRow.getCell(1).font = { bold: true, size: 11, color: { argb: primaryColor } };
    breakdownHeaderRow.height = 24;
    currentRow++;

    // Baker McKenzie fees (already accumulated from rounded line items)
    const bmRow = worksheet.getRow(currentRow);
    bmRow.values = ['', 'Baker McKenzie Fees', '', '', bmTotal, '', ''];
    bmRow.getCell(5).numFmt = '#,##0';
    bmRow.getCell(5).alignment = { horizontal: 'right' };
    bmRow.getCell(2).font = { size: 11 };
    currentRow++;

    // Local Counsel fees (already accumulated from rounded line items)
    if (lcTotal > 0) {
      const lcRow = worksheet.getRow(currentRow);
      lcRow.values = ['', 'Local Counsel Fees', '', '', lcTotal, '', ''];
      lcRow.getCell(5).numFmt = '#,##0';
      lcRow.getCell(5).alignment = { horizontal: 'right' };
      lcRow.getCell(2).font = { size: 11 };
      currentRow++;
    }

    // Aggregate Line Item Estimate (sum of all line items)
    currentRow++;
    const aggregateRow = worksheet.getRow(currentRow);
    aggregateRow.values = ['', 'AGGREGATE LINE ITEM ESTIMATE', '', '', grandTotal, '', ''];
    aggregateRow.getCell(5).numFmt = '#,##0';
    aggregateRow.getCell(5).alignment = { horizontal: 'right' };
    aggregateRow.getCell(5).font = { bold: true, size: 12, color: { argb: primaryColor } };
    aggregateRow.getCell(5).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    aggregateRow.getCell(2).font = { bold: true, size: 12, color: { argb: primaryColor } };
    aggregateRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'medium', color: { argb: primaryColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
      };
    });
    aggregateRow.height = 26;
    currentRow++;

    // If AFAs are applied, show the fee arrangement summary below
    if (filterResult.appliedAFAs.length > 0) {
      const primaryAFA = enabledAFAs.find(afa => 
        afa.is_enabled && ['fixed_fee_whole', 'fixed_fee_phase', 'fee_cap', 'collar', 'blended_rate'].includes(afa.afa_type)
      );
      
      for (const afa of filterResult.appliedAFAs) {
        const afaDetailRow = worksheet.getRow(currentRow);
        afaDetailRow.values = ['', `  ${afa.label}`, '', '', '', '', afa.description];
        afaDetailRow.getCell(2).font = { size: 10, color: { argb: 'FF2563EB' } };
        afaDetailRow.getCell(7).font = { size: 10, color: { argb: 'FF6B7280' } };
        afaDetailRow.getCell(7).alignment = { wrapText: true };
        currentRow++;
      }
      
      if (primaryAFA?.client_price && primaryAFA.client_price !== grandTotal) {
        currentRow++;
        const feeProposalRow = worksheet.getRow(currentRow);
        feeProposalRow.values = ['', 'FEE PROPOSAL', '', '', smartRound(primaryAFA.client_price), '', ''];
        feeProposalRow.getCell(5).numFmt = '#,##0';
        feeProposalRow.getCell(5).alignment = { horizontal: 'right' };
        feeProposalRow.getCell(5).font = { bold: true, size: 13, color: { argb: 'FF2563EB' } };
        feeProposalRow.getCell(5).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDBEAFE' },
        };
        feeProposalRow.getCell(2).font = { bold: true, size: 13, color: { argb: 'FF2563EB' } };
        feeProposalRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF2563EB' } },
            bottom: { style: 'double', color: { argb: 'FF2563EB' } },
          };
        });
        feeProposalRow.height = 28;
        currentRow++;
      }
    } else {
      aggregateRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium', color: { argb: primaryColor } },
          bottom: { style: 'double', color: { argb: primaryColor } },
        };
      });
    }

    // "If assumptions not all true" alternative total
    const hasAnyAltPricing = validItems.some(item => item.assumption_linked && (item.alt_fee_upper || item.alt_fee_lower));
    if (hasAnyAltPricing) {
      currentRow++;
      const altGrandTotal = validItems.reduce((sum, item) => {
        if (item.assumption_linked && (item.alt_fee_upper || item.alt_fee_lower)) {
          return sum + smartRound(item.alt_fee_upper || item.alt_fee_lower || 0);
        }
        return sum + (item.fee_amount || 0);
      }, 0);
      const altDelta = altGrandTotal - grandTotal;

      const altTotalRow = worksheet.getRow(currentRow);
      altTotalRow.values = ['', 'IF IDENTIFIED ASSUMPTIONS ARE NOT TRUE', '', '', smartRound(altGrandTotal), '', ''];
      altTotalRow.getCell(5).numFmt = '#,##0';
      altTotalRow.getCell(5).alignment = { horizontal: 'right' };
      altTotalRow.getCell(5).font = { bold: true, size: 11, color: { argb: 'FFB45309' } };
      altTotalRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FFB45309' } };
      altTotalRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFBEB' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFB45309' } },
          bottom: { style: 'thin', color: { argb: 'FFB45309' } },
        };
      });
      const altNotesCell = altTotalRow.getCell(notesColumnIndex);
      altNotesCell.value = altDelta > 0 ? `+${smartRound(altDelta).toLocaleString()} vs base` : `${smartRound(altDelta).toLocaleString()} vs base`;
      altNotesCell.font = { size: 9, color: { argb: 'FFB45309' } };
      altTotalRow.height = 24;
      currentRow++;
    }
  }

  // Team Member Breakdown section (optional)
  if (includeTeamBreakdown && teamMemberData && teamMemberData.length > 0) {
    const teamCurrencySymbol = teamCurrency === 'GBP' ? '£' : teamCurrency === 'USD' ? '$' : teamCurrency === 'EUR' ? '€' : (teamCurrency || currencySymbol);
    
    currentRow += 2;
    
    // Section header
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const teamHeaderCell = worksheet.getCell(`A${currentRow}`);
    teamHeaderCell.value = '👥 Team Composition & Allocation';
    teamHeaderCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    teamHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor },
    };
    teamHeaderCell.alignment = { vertical: 'middle' };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;

    // Check if discounted rates AFA is active
    const discountAfa = enabledAFAs.find(a => a.afa_type === 'discounted_rates' && a.is_enabled);
    const hasAfaRates = !!discountAfa && teamMemberData.some(m => m.afaRate != null);

    // Add discount note at top of team section if discounted rates AFA is active
    if (discountAfa) {
      const discConfig = discountAfa.config as { discountPercent?: number };
      const pct = discConfig?.discountPercent || 0;
      worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
      const discountNoteCell = worksheet.getCell(`A${currentRow}`);
      discountNoteCell.value = `Rates shown reflect a ${pct}% discount from standard rates.`;
      discountNoteCell.font = { size: 10, color: { argb: 'FF2563EB' } };
      discountNoteCell.alignment = { vertical: 'middle' };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
    }

    // Table header row - use columns B, C, (D if AFA), then Hours, Fee
    const teamTableHeader = worksheet.getRow(currentRow);
    if (hasAfaRates) {
      teamTableHeader.values = ['', 'Team Member', `Standard Rate (${teamCurrencySymbol}/hr)`, `AFA Rate (${teamCurrencySymbol}/hr)`, 'Estimated Hours', 'Estimated Fee'];
    } else {
      teamTableHeader.values = ['', 'Team Member', `Rate (${teamCurrencySymbol}/hr)`, 'Estimated Hours', 'Estimated Fee'];
    }
    const teamColCount = hasAfaRates ? 6 : 5;
    teamTableHeader.eachCell((cell, colNumber) => {
      if (colNumber >= 2 && colNumber <= teamColCount) {
        cell.font = { bold: true, size: 10, color: { argb: 'FF374151' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: borderColor } },
        };
        cell.alignment = { horizontal: colNumber >= 3 ? 'center' : 'left', vertical: 'middle' };
      }
    });
    teamTableHeader.height = 24;
    currentRow++;

    // Team member rows
    let totalHours = 0;
    let totalRevenue = 0;

    // Sort by rate descending (most senior first)
    const sortedTeam = [...teamMemberData].sort((a, b) => b.rate - a.rate);

    for (const member of sortedTeam) {
      const memberRow = worksheet.getRow(currentRow);
      if (hasAfaRates) {
        memberRow.values = ['', member.label, member.rate, member.afaRate || member.rate, member.hours, smartRound(member.revenue)];
      } else {
        memberRow.values = ['', member.label, member.rate, member.hours, smartRound(member.revenue)];
      }
      
      memberRow.getCell(2).font = { size: 10 };
      memberRow.getCell(3).numFmt = '#,##0';
      memberRow.getCell(3).alignment = { horizontal: 'center' };
      memberRow.getCell(3).font = { size: 10, color: { argb: 'FF6B7280' } };

      if (hasAfaRates) {
        memberRow.getCell(4).numFmt = '#,##0';
        memberRow.getCell(4).alignment = { horizontal: 'center' };
        memberRow.getCell(4).font = { size: 10, color: { argb: 'FF2563EB' } };
        memberRow.getCell(5).numFmt = '#,##0.0';
        memberRow.getCell(5).alignment = { horizontal: 'center' };
        memberRow.getCell(5).font = { size: 10 };
        memberRow.getCell(6).numFmt = '#,##0';
        memberRow.getCell(6).alignment = { horizontal: 'center' };
        memberRow.getCell(6).font = { size: 10, bold: true };
      } else {
        memberRow.getCell(4).numFmt = '#,##0.0';
        memberRow.getCell(4).alignment = { horizontal: 'center' };
        memberRow.getCell(4).font = { size: 10 };
        memberRow.getCell(5).numFmt = '#,##0';
        memberRow.getCell(5).alignment = { horizontal: 'center' };
        memberRow.getCell(5).font = { size: 10, bold: true };
      }

      // Alternating row colors
      if (currentRow % 2 === 0) {
        memberRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        });
      } else {
        memberRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
        });
      }

      memberRow.eachCell((cell) => {
        cell.border = { bottom: { style: 'hair', color: { argb: borderColor } } };
      });

      totalHours += member.hours;
      totalRevenue += member.revenue;
      currentRow++;
    }

    // Totals row
    const teamTotalRow = worksheet.getRow(currentRow);
    const hoursCol = hasAfaRates ? 5 : 4;
    const feeCol = hasAfaRates ? 6 : 5;
    if (hasAfaRates) {
      teamTotalRow.values = ['', 'TOTAL', '', '', totalHours, smartRound(totalRevenue)];
    } else {
      teamTotalRow.values = ['', 'TOTAL', '', totalHours, smartRound(totalRevenue)];
    }
    teamTotalRow.getCell(2).font = { bold: true, size: 11, color: { argb: primaryColor } };
    teamTotalRow.getCell(hoursCol).numFmt = '#,##0.0';
    teamTotalRow.getCell(hoursCol).alignment = { horizontal: 'center' };
    teamTotalRow.getCell(hoursCol).font = { bold: true, size: 11, color: { argb: primaryColor } };
    teamTotalRow.getCell(feeCol).numFmt = '#,##0';
    teamTotalRow.getCell(feeCol).alignment = { horizontal: 'center' };
    teamTotalRow.getCell(feeCol).font = { bold: true, size: 11, color: { argb: primaryColor } };
    teamTotalRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'medium', color: { argb: primaryColor } },
        bottom: { style: 'double', color: { argb: primaryColor } },
      };
    });
    teamTotalRow.height = 24;
    currentRow++;

    // Blended rate — use AFA blended rate if available (client-facing), otherwise weighted average
    if (totalHours > 0) {
      const displayRate = afaBlendedRate || (totalRevenue / totalHours);
      const blendedRow = worksheet.getRow(currentRow);
      blendedRow.values = ['', `Blended Rate: ${teamCurrencySymbol}${Math.round(displayRate).toLocaleString()}/hr`];
      blendedRow.getCell(2).font = { size: 10, color: { argb: 'FF6B7280' } };
      currentRow++;
    }
  }

  // Footer notes
  currentRow += 3;

  // Standard notes
  worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
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
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const noteCell = worksheet.getCell(`A${currentRow}`);
    noteCell.value = `• ${assumption}`;
    noteCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };
    noteCell.alignment = { wrapText: true };
    currentRow++;
  }

  // PC Sum explanatory note (only if there are PC Sum items)
  if (hasPcSumItems && !hideUpperAndPcSum) {
    currentRow++;
    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const pcSumHeaderCell = worksheet.getCell(`A${currentRow}`);
    pcSumHeaderCell.value = 'PC Sum (Provisional Contract Sum):';
    pcSumHeaderCell.font = { bold: true, size: 10, color: { argb: 'FF7C3AED' } };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
    const pcSumNoteCell = worksheet.getCell(`A${currentRow}`);
    pcSumNoteCell.value = 'Items marked as "PC Sum" represent provisional cost estimates where the scope of work is not yet fully defined. These figures are highly indicative and subject to revision once the relevant aspects of the transaction structure have been finalized.';
    pcSumNoteCell.font = { size: 9, color: { argb: 'FF7C3AED' }, italic: true };
    pcSumNoteCell.alignment = { wrapText: true };
    worksheet.getRow(currentRow).height = 36;
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
  const filePrefix = hideUpperAndPcSum ? 'Scope_Proposal' : 'Fee_Proposal';
  link.download = `${filePrefix}_${safeClientName}_${safeProposalName}_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
