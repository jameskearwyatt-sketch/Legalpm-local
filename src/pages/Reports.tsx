import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Download, Briefcase, Rocket, Loader2, BarChart3, TrendingUp, DollarSign, ArrowLeftRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMatters, MatterWithFinancials } from '@/lib/hooks/useMatters';
import { useExchangeRates } from '@/lib/hooks/useExchangeRates';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { convertToUsd } from '@/lib/currencyUtils';
import { getMatterClientDisplayName } from '@/lib/clientUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import RealizationReport from '@/components/reports/RealizationReport';
import BudgetBurnReport from '@/components/reports/BudgetBurnReport';
import WipMovementReport from '@/components/reports/WipMovementReport';
import CollectionReport from '@/components/reports/CollectionReport';
import SavedReportsList from '@/components/reports/SavedReportsList';

export default function Reports() {
  const { matters, isLoading } = useMatters();
  const { data: exchangeData } = useExchangeRates();
  const { user } = useAuth();
  const { toast } = useToast();
  const [exportingMatters, setExportingMatters] = useState(false);
  const [exportingPipeline, setExportingPipeline] = useState(false);

  // Fetch current user's profile
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = userProfile?.full_name || '';

  // Get live rates for currency conversion
  const gbpToUsdRate = exchangeData?.rates?.GBP ? 1 / exchangeData.rates.GBP : 1.35;
  const liveRates = exchangeData?.rates;

  // Helper to convert amount to USD
  const toUsd = (amount: number, feeCurrency: string, exchangeRate: number) => {
    return convertToUsd(amount, feeCurrency, exchangeRate, gbpToUsdRate, liveRates);
  };

  // Helper to check if user is MMA or BP for a matter
  const isMyMatter = (matter: MatterWithFinancials): boolean => {
    if (!userName) return false;
    const mma = matter.matter_managing_attorney || '';
    const bp = matter.lead_partner || '';
    const userNameLower = userName.toLowerCase().trim();
    const isMMA = mma.trim() !== '' && mma.toLowerCase().trim() === userNameLower;
    const isBP = bp.trim() !== '' && bp.toLowerCase().trim() === userNameLower;
    return isMMA || isBP;
  };

  // Helper to calculate totals for a set of matters
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

  const exportToExcel = async (data: MatterWithFinancials[], filename: string, title: string) => {
    // Split data into my matters and other matters
    const myMatters = data.filter(isMyMatter);
    const otherMatters = data.filter((m) => !isMyMatter(m));

    const myTotals = calculateTotals(myMatters);
    const otherTotals = calculateTotals(otherMatters);
    const grandTotals = {
      budget: myTotals.budget + otherTotals.budget,
      wip: myTotals.wip + otherTotals.wip,
      billed: myTotals.billed + otherTotals.billed,
      paid: myTotals.paid + otherTotals.paid,
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Matter Management';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(title, {
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

    // Section 1: My Matters (where I am MMA or BP)
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

    // Subtotal for my matters
    addSubtotalRow(worksheet, currentRow, 'SUBTOTAL (My Matters)', myTotals, 'FFD1FAE5');
    currentRow += 2;

    // Section 2: Other Matters (where I am neither MMA nor BP)
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

    // Subtotal for other matters
    addSubtotalRow(worksheet, currentRow, 'SUBTOTAL (Other Matters)', otherTotals, 'FFDBEAFE');
    currentRow += 2;

    // Grand Total
    addSubtotalRow(worksheet, currentRow, 'GRAND TOTAL', grandTotals, 'FFFEF3C7');
    // Make grand total row stand out more
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

    // Add summary chart sheet
    const chartSheet = workbook.addWorksheet('Summary Chart');

    // Chart data - aggregate by practice area
    const practiceAreaData: Record<string, { budget: number; wip: number; billed: number; paid: number; count: number }> = {};
    data.forEach((matter) => {
      const practiceArea = matter.practice_area || 'Unknown';
      const feeCurrency = matter.fee_currency || 'GBP';
      const exchangeRate = matter.exchange_rate || 1;

      if (!practiceAreaData[practiceArea]) {
        practiceAreaData[practiceArea] = { budget: 0, wip: 0, billed: 0, paid: 0, count: 0 };
      }
      practiceAreaData[practiceArea].budget += toUsd(matter.fee_amount_upper_end || 0, feeCurrency, exchangeRate);
      practiceAreaData[practiceArea].wip += toUsd(matter.latest_snapshot?.wip_amount || 0, feeCurrency, exchangeRate);
      practiceAreaData[practiceArea].billed += toUsd(matter.latest_snapshot?.billed_amount || 0, feeCurrency, exchangeRate);
      practiceAreaData[practiceArea].paid += toUsd(matter.latest_snapshot?.paid_amount || 0, feeCurrency, exchangeRate);
      practiceAreaData[practiceArea].count += 1;
    });

    chartSheet.mergeCells('A1:F1');
    const chartTitle = chartSheet.getCell('A1');
    chartTitle.value = `${title} - Summary by Practice Area`;
    chartTitle.font = { size: 16, bold: true, color: { argb: 'FF1F2937' } };
    chartTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    chartSheet.getRow(1).height = 30;

    const chartHeaders = ['Practice Area', 'Count', 'Total Budget (USD)', 'WIP (USD)', 'Billed (USD)', 'Paid (USD)'];
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

    let chartRowIndex = 4;
    Object.entries(practiceAreaData).forEach(([practiceArea, stats], index) => {
      const row = chartSheet.getRow(chartRowIndex);
      row.getCell(1).value = practiceArea;
      row.getCell(2).value = stats.count;
      row.getCell(3).value = stats.budget;
      row.getCell(4).value = stats.wip;
      row.getCell(5).value = stats.billed;
      row.getCell(6).value = stats.paid;

      [3, 4, 5, 6].forEach((col) => {
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
      const liveMatters = matters.filter((m) => m.category === 'Live');
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
      const pipelineMatters = matters.filter((m) => m.category === 'Pipeline');
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">Financial analysis and data export</p>
        </div>

        <Tabs defaultValue="export" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="export" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </TabsTrigger>
            <TabsTrigger value="realization" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Realization
            </TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Budget Burn
            </TabsTrigger>
            <TabsTrigger value="wip" className="gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5" /> WIP Movement
            </TabsTrigger>
            <TabsTrigger value="collection" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Collection
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5">
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex flex-col gap-4">
                <Button
                  size="lg"
                  className="h-16 text-lg gap-3"
                  onClick={handleExportAllMatters}
                  disabled={isLoading || exportingMatters}
                >
                  {exportingMatters ? <Loader2 className="h-5 w-5 animate-spin" /> : <Briefcase className="h-5 w-5" />}
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
                  {exportingPipeline ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                  Export All Pipeline
                  <Download className="h-5 w-5 ml-auto" />
                </Button>
              </div>
              {isLoading && <p className="text-center text-muted-foreground text-sm">Loading matters data...</p>}
            </div>
          </TabsContent>

          <TabsContent value="realization">
            <RealizationReport />
          </TabsContent>

          <TabsContent value="budget">
            <BudgetBurnReport />
          </TabsContent>

          <TabsContent value="wip">
            <WipMovementReport />
          </TabsContent>

          <TabsContent value="collection">
            <CollectionReport />
          </TabsContent>

          <TabsContent value="saved">
            <SavedReportsList />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
