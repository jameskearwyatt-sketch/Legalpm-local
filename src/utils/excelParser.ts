import * as XLSX from 'xlsx';

export interface CellInfo {
  address: string;
  value: any;
  formula?: string;
  type: string;
}

export interface SheetAnalysis {
  name: string;
  rowCount: number;
  colCount: number;
  cells: CellInfo[];
  usedRange: string;
}

export interface WorkbookAnalysis {
  sheetNames: string[];
  sheets: SheetAnalysis[];
}

export async function analyzeExcelFile(file: File): Promise<WorkbookAnalysis> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { 
    cellFormula: true,
    cellStyles: true,
    cellNF: true,
  });
  
  const sheets: SheetAnalysis[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = sheet['!ref'];
    const cells: CellInfo[] = [];
    
    // Get all cells with their formulas
    for (const cellAddress in sheet) {
      if (cellAddress.startsWith('!')) continue; // Skip special keys
      
      const cell = sheet[cellAddress];
      cells.push({
        address: cellAddress,
        value: cell.v,
        formula: cell.f,
        type: cell.t, // s=string, n=number, b=boolean, e=error, d=date
      });
    }
    
    // Calculate dimensions
    const decoded = range ? XLSX.utils.decode_range(range) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    
    sheets.push({
      name: sheetName,
      rowCount: decoded.e.r - decoded.s.r + 1,
      colCount: decoded.e.c - decoded.s.c + 1,
      cells,
      usedRange: range || 'Empty',
    });
  }
  
  return {
    sheetNames: workbook.SheetNames,
    sheets,
  };
}

export function getFormulaCells(analysis: WorkbookAnalysis): { sheet: string; address: string; formula: string; value: any }[] {
  const formulas: { sheet: string; address: string; formula: string; value: any }[] = [];
  
  for (const sheet of analysis.sheets) {
    for (const cell of sheet.cells) {
      if (cell.formula) {
        formulas.push({
          sheet: sheet.name,
          address: cell.address,
          formula: cell.formula,
          value: cell.value,
        });
      }
    }
  }
  
  return formulas;
}

export function getSummary(analysis: WorkbookAnalysis): string {
  let summary = `📊 **Workbook Summary**\n\n`;
  summary += `**Sheets:** ${analysis.sheetNames.length}\n`;
  summary += `- ${analysis.sheetNames.join('\n- ')}\n\n`;
  
  for (const sheet of analysis.sheets) {
    const formulaCount = sheet.cells.filter(c => c.formula).length;
    const dataCount = sheet.cells.filter(c => c.value !== undefined && !c.formula).length;
    
    summary += `**${sheet.name}**\n`;
    summary += `  - Range: ${sheet.usedRange}\n`;
    summary += `  - Size: ${sheet.rowCount} rows × ${sheet.colCount} cols\n`;
    summary += `  - Data cells: ${dataCount}\n`;
    summary += `  - Formula cells: ${formulaCount}\n\n`;
  }
  
  return summary;
}
