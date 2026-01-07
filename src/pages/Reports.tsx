import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Download, Briefcase, Rocket, Loader2 } from 'lucide-react';
import { useMatters, MatterWithFinancials } from '@/lib/hooks/useMatters';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import ExcelJS from 'exceljs';

export default function Reports() {
  const { matters, isLoading } = useMatters();
  const { toast } = useToast();
  const [exportingMatters, setExportingMatters] = useState(false);
  const [exportingPipeline, setExportingPipeline] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportToExcel = async (data: MatterWithFinancials[], filename: string, title: string) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Matter Management';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(title, {
      views: [{ state: 'frozen', ySplit: 3 }],
    });

    // Title row
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    // Subtitle with date
    worksheet.mergeCells('A2:J2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Generated on ${new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`;
    subtitleCell.font = { size: 11, italic: true, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    // Headers
    const headers = [
      'Client',
      'Matter Name',
      'Matter Number',
      'Practice Area',
      'Status',
      'Category',
      'Total Budget',
      'WIP',
      'Billed',
      'Paid',
    ];

    const headerRow = worksheet.getRow(3);
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

    // Data rows
    data.forEach((matter, index) => {
      const row = worksheet.getRow(index + 4);
      const clientName = matter.clients?.name || 'Unknown';
      const wip = matter.latest_snapshot?.wip_amount || 0;
      const billed = matter.latest_snapshot?.billed_amount || 0;
      const paid = matter.latest_snapshot?.paid_amount || 0;

      row.getCell(1).value = clientName;
      row.getCell(2).value = matter.matter_name;
      row.getCell(3).value = matter.matter_number;
      row.getCell(4).value = matter.practice_area || '-';
      row.getCell(5).value = matter.status;
      row.getCell(6).value = matter.category;
      row.getCell(7).value = matter.fee_amount_upper_end || 0;
      row.getCell(8).value = wip;
      row.getCell(9).value = billed;
      row.getCell(10).value = paid;

      // Format currency columns
      [7, 8, 9, 10].forEach(col => {
        row.getCell(col).numFmt = '"$"#,##0';
      });

      // Alternate row colors
      const fillColor = index % 2 === 0 ? 'FFF9FAFB' : 'FFFFFFFF';
      for (let col = 1; col <= 10; col++) {
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

    // Set column widths
    worksheet.getColumn(1).width = 22;
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(3).width = 18;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 12;
    worksheet.getColumn(7).width = 15;
    worksheet.getColumn(8).width = 15;
    worksheet.getColumn(9).width = 15;
    worksheet.getColumn(10).width = 15;

    // Summary row
    const summaryRowIndex = data.length + 5;
    const summaryRow = worksheet.getRow(summaryRowIndex);
    summaryRow.getCell(1).value = 'TOTALS';
    summaryRow.getCell(1).font = { bold: true };
    
    const totalBudget = data.reduce((sum, m) => sum + (m.fee_amount_upper_end || 0), 0);
    const totalWip = data.reduce((sum, m) => sum + (m.latest_snapshot?.wip_amount || 0), 0);
    const totalBilled = data.reduce((sum, m) => sum + (m.latest_snapshot?.billed_amount || 0), 0);
    const totalPaid = data.reduce((sum, m) => sum + (m.latest_snapshot?.paid_amount || 0), 0);

    summaryRow.getCell(7).value = totalBudget;
    summaryRow.getCell(8).value = totalWip;
    summaryRow.getCell(9).value = totalBilled;
    summaryRow.getCell(10).value = totalPaid;

    [7, 8, 9, 10].forEach(col => {
      summaryRow.getCell(col).numFmt = '"$"#,##0';
      summaryRow.getCell(col).font = { bold: true };
    });

    for (let col = 1; col <= 10; col++) {
      summaryRow.getCell(col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' },
      };
      summaryRow.getCell(col).border = {
        top: { style: 'medium', color: { argb: 'FF3B82F6' } },
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      };
    }
    summaryRow.height = 28;

    // Add chart sheet
    const chartSheet = workbook.addWorksheet('Summary Chart');
    
    // Chart data - aggregate by category or status
    const categoryData: Record<string, { budget: number; wip: number; billed: number; paid: number; count: number }> = {};
    data.forEach(matter => {
      const cat = matter.category || 'Unknown';
      if (!categoryData[cat]) {
        categoryData[cat] = { budget: 0, wip: 0, billed: 0, paid: 0, count: 0 };
      }
      categoryData[cat].budget += matter.fee_amount_upper_end || 0;
      categoryData[cat].wip += matter.latest_snapshot?.wip_amount || 0;
      categoryData[cat].billed += matter.latest_snapshot?.billed_amount || 0;
      categoryData[cat].paid += matter.latest_snapshot?.paid_amount || 0;
      categoryData[cat].count += 1;
    });

    // Chart title
    chartSheet.mergeCells('A1:F1');
    const chartTitle = chartSheet.getCell('A1');
    chartTitle.value = `${title} - Summary by Category`;
    chartTitle.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } };
    chartTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    chartSheet.getRow(1).height = 30;

    // Chart headers
    const chartHeaders = ['Category', 'Count', 'Total Budget', 'WIP', 'Billed', 'Paid'];
    const chartHeaderRow = chartSheet.getRow(3);
    chartHeaders.forEach((header, index) => {
      const cell = chartHeaderRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    chartHeaderRow.height = 26;

    // Chart data rows
    let chartRowIndex = 4;
    Object.entries(categoryData).forEach(([category, stats], index) => {
      const row = chartSheet.getRow(chartRowIndex);
      row.getCell(1).value = category;
      row.getCell(2).value = stats.count;
      row.getCell(3).value = stats.budget;
      row.getCell(4).value = stats.wip;
      row.getCell(5).value = stats.billed;
      row.getCell(6).value = stats.paid;

      [3, 4, 5, 6].forEach(col => {
        row.getCell(col).numFmt = '"$"#,##0';
      });

      const fillColor = index % 2 === 0 ? 'FFF0FDF4' : 'FFFFFFFF';
      for (let col = 1; col <= 6; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor },
        };
        row.getCell(col).alignment = { vertical: 'middle' };
      }
      row.height = 24;
      chartRowIndex++;
    });

    // Set chart column widths
    chartSheet.getColumn(1).width = 18;
    chartSheet.getColumn(2).width = 10;
    chartSheet.getColumn(3).width = 18;
    chartSheet.getColumn(4).width = 15;
    chartSheet.getColumn(5).width = 15;
    chartSheet.getColumn(6).width = 15;

    // Download the file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAllMatters = async () => {
    try {
      setExportingMatters(true);
      const liveMatters = matters.filter(m => m.category === 'Live');
      await exportToExcel(liveMatters, 'All_Matters', 'All Live Matters');
      toast({ title: 'Export successful', description: `Exported ${liveMatters.length} live matters to Excel` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Failed to generate Excel file', variant: 'destructive' });
    } finally {
      setExportingMatters(false);
    }
  };

  const handleExportPipeline = async () => {
    try {
      setExportingPipeline(true);
      const pipelineMatters = matters.filter(m => m.category === 'Pipeline');
      await exportToExcel(pipelineMatters, 'Pipeline_Matters', 'Pipeline Matters');
      toast({ title: 'Export successful', description: `Exported ${pipelineMatters.length} pipeline matters to Excel` });
    } catch (error) {
      toast({ title: 'Export failed', description: 'Failed to generate Excel file', variant: 'destructive' });
    } finally {
      setExportingPipeline(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Report Export</h1>
          <p className="text-muted-foreground mt-2">Download formatted Excel reports with charts</p>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            size="lg"
            className="h-16 text-lg gap-3"
            onClick={handleExportAllMatters}
            disabled={isLoading || exportingMatters}
          >
            {exportingMatters ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Briefcase className="h-5 w-5" />
            )}
            Export All Matters
            <Download className="h-5 w-5 ml-auto" />
          </Button>

          <Button
            size="lg"
            variant="secondary"
            className="h-16 text-lg gap-3"
            onClick={handleExportPipeline}
            disabled={isLoading || exportingPipeline}
          >
            {exportingPipeline ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5" />
            )}
            Export All Pipeline
            <Download className="h-5 w-5 ml-auto" />
          </Button>
        </div>

        {isLoading && (
          <p className="text-center text-muted-foreground text-sm">Loading matters data...</p>
        )}
      </div>
    </AppLayout>
  );
}
