import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Save, Download } from 'lucide-react';
import { DateRange } from '@/lib/hooks/useReportData';
import { useSavedReports, ReportConfig } from '@/lib/hooks/useSavedReports';

interface ReportControlsProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  groupBy: string;
  onGroupByChange: (value: string) => void;
  groupByOptions: { value: string; label: string }[];
  reportType: string;
  onExport?: () => void;
  exporting?: boolean;
}

export default function ReportControls({
  dateRange,
  onDateRangeChange,
  groupBy,
  onGroupByChange,
  groupByOptions,
  reportType,
  onExport,
  exporting,
}: ReportControlsProps) {
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const { createReport } = useSavedReports();

  const handleSave = async () => {
    if (!saveName.trim()) return;
    await createReport.mutateAsync({
      name: saveName.trim(),
      report_type: reportType,
      config: {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        groupBy: groupBy as 'month' | 'quarter',
      },
    });
    setSaveName('');
    setSaveOpen(false);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
      <div className="flex gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateRange.start.toISOString().split('T')[0]}
            onChange={e => onDateRangeChange({ ...dateRange, start: new Date(e.target.value) })}
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateRange.end.toISOString().split('T')[0]}
            onChange={e => onDateRangeChange({ ...dateRange, end: new Date(e.target.value) })}
            className="w-36"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Group by</Label>
        <Select value={groupBy} onValueChange={onGroupByChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupByOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Report Configuration</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <Label>Report Name</Label>
              <Input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g., Monthly Realization - Q1 2026"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={!saveName.trim() || createReport.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        )}
      </div>
    </div>
  );
}
