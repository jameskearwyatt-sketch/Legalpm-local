import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, FileText } from 'lucide-react';
import { useSavedReports, SavedReport } from '@/lib/hooks/useSavedReports';
import { formatDistanceToNow } from 'date-fns';

const REPORT_TYPE_LABELS: Record<string, string> = {
  realization: 'Realization Rate',
  budget_burn: 'Budget Burn',
  wip_movement: 'WIP Movement',
  collection: 'Collection Rate',
};

interface SavedReportsListProps {
  onLoad?: (report: SavedReport) => void;
}

export default function SavedReportsList({ onLoad }: SavedReportsListProps) {
  const { savedReports, isLoading, deleteReport } = useSavedReports();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (savedReports.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No saved reports yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Save a report configuration from any report tab to see it here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {savedReports.map(report => (
        <Card key={report.id} className="hover:bg-muted/50 transition-colors">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{report.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{REPORT_TYPE_LABELS[report.report_type] || report.report_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onLoad && (
                  <Button variant="outline" size="sm" onClick={() => onLoad(report)}>
                    Load
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deleteReport.mutate(report.id)}
                  disabled={deleteReport.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
