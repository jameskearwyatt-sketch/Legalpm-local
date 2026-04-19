import ExcelJS from 'exceljs';

interface ColumnDef {
  header: string;
  key: string;
  format?: 'currency' | 'percent' | 'number';
}

interface ExportOptions {
  title: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}

export async function exportReportToExcel({ title, columns, rows }: ExportOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Legal Practice Manager';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title);

  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, columns.length);

  const dateRow = sheet.addRow([`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`]);
  dateRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  sheet.mergeCells(2, 1, 2, columns.length);

  sheet.addRow([]);

  const headerRow = sheet.addRow(columns.map(c => c.header));
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } },
    };
  });

  columns.forEach((col, i) => {
    const colObj = sheet.getColumn(i + 1);
    colObj.width = col.format === 'currency' ? 18 : col.format === 'percent' ? 14 : 20;
  });

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const values = columns.map(col => {
      const val = row[col.key];
      if (col.format === 'percent' && typeof val === 'number') return val / 100;
      return val;
    });

    const excelRow = sheet.addRow(values);

    if (ri % 2 === 1) {
      excelRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    columns.forEach((col, ci) => {
      const cell = excelRow.getCell(ci + 1);
      if (col.format === 'currency') {
        cell.numFmt = '$#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (col.format === 'percent') {
        cell.numFmt = '0.0%';
        cell.alignment = { horizontal: 'right' };
      } else if (col.format === 'number') {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title} - ${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
