/**
 * Shared "Analysis History" table for the 4 simple analyst tools.
 *
 * Each per-analyst `XxxAnalysisList` owns the view toggle between the list
 * and the report (since the Report component type differs per analyst),
 * but delegates the table rendering, search, empty state, and delete dialog
 * to this shared component.
 */
import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  FileText,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

/** Minimal shape each analysis row must satisfy to render in the shared table. */
export interface AnalystTableRow {
  id: string;
  project_name: string;
  document_file_name: string;
  jurisdiction: string | null;
  analysis_type: string;
  perspective: string;
  is_agreed: boolean;
  created_at: string;
}

export interface ExtraColumn<T extends AnalystTableRow> {
  header: string;
  render: (row: T) => ReactNode;
}

interface Props<T extends AnalystTableRow> {
  analyses: T[];
  isLoading: boolean;
  /** Card subtitle, e.g. "View and manage your past tolling analyses" */
  description: string;
  /** Secondary hint shown under the empty state, e.g. "Upload a tolling agreement to get started" */
  emptyStateHint?: string;
  /** Label rendered in the "Type" badge column, e.g. "vs Knowledge" / "vs Term Sheet" */
  getAnalysisTypeLabel: (type: string) => string;
  /** Label rendered in the "Perspective" badge column */
  getPerspectiveLabel: (perspective: string) => string;
  /** Extra columns inserted between Type and Perspective (e.g. Technology, Credit Type, Stage) */
  extraColumns?: ExtraColumn<T>[];
  onOpenAnalysis: (id: string) => void;
  onDeleteAnalysis: (id: string) => Promise<void> | void;
}

export function AnalystAnalysisTable<T extends AnalystTableRow>({
  analyses,
  isLoading,
  description,
  emptyStateHint,
  getAnalysisTypeLabel,
  getPerspectiveLabel,
  extraColumns = [],
  onOpenAnalysis,
  onDeleteAnalysis,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = analyses.filter(a =>
    a.project_name.toLowerCase().includes(search.toLowerCase()) ||
    a.document_file_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.jurisdiction?.toLowerCase().includes(search.toLowerCase())),
  );

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await onDeleteAnalysis(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search analyses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? 'No analyses match your search' : 'No analyses yet'}
              </p>
              {emptyStateHint && !search && (
                <p className="text-sm text-muted-foreground mt-1">{emptyStateHint}</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  {extraColumns.map((c) => (
                    <TableHead key={c.header}>{c.header}</TableHead>
                  ))}
                  <TableHead>Perspective</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium" onClick={() => onOpenAnalysis(a.id)}>
                      <div>
                        <p>{a.project_name}</p>
                        <p className="text-xs text-muted-foreground">{a.document_file_name}</p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => onOpenAnalysis(a.id)}>
                      <Badge variant="outline">{getAnalysisTypeLabel(a.analysis_type)}</Badge>
                    </TableCell>
                    {extraColumns.map((c) => (
                      <TableCell key={c.header} onClick={() => onOpenAnalysis(a.id)}>
                        {c.render(a)}
                      </TableCell>
                    ))}
                    <TableCell onClick={() => onOpenAnalysis(a.id)}>
                      <Badge variant="secondary">{getPerspectiveLabel(a.perspective)}</Badge>
                    </TableCell>
                    <TableCell onClick={() => onOpenAnalysis(a.id)}>{a.jurisdiction || '-'}</TableCell>
                    <TableCell onClick={() => onOpenAnalysis(a.id)}>
                      {a.is_agreed ? (
                        <Badge className="bg-green-100 text-green-800 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Agreed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={() => onOpenAnalysis(a.id)}>
                      {format(new Date(a.created_at), 'PP')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenAnalysis(a.id)}>
                            <Eye className="h-4 w-4 mr-2" /> View Report
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirmId(a.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this analysis and all extracted positions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
