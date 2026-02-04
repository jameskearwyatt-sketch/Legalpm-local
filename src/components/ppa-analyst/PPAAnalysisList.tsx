import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Search, MoreHorizontal, Eye, Trash2, FileText, CheckCircle2, Loader2, GitCompare, RefreshCw, Sparkles } from 'lucide-react';
import { usePPAAnalyses, usePPAPositions, PPAAnalysis, PPA_STRUCTURE_LABELS, PPAStructureType } from '@/lib/hooks/usePPAAnalyses';
import { format } from 'date-fns';
import { PPAAnalysisReport } from './PPAAnalysisReport';
import { PPACompareUpload } from './PPACompareUpload';
import { PPAComparisonReport } from './PPAComparisonReport';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PPAAnalysisListProps {
  onReanalyze?: (analysis: PPAAnalysis) => void;
}

export function PPAAnalysisList({ onReanalyze }: PPAAnalysisListProps) {
  const { analyses, isLoading, deleteAnalysis } = usePPAAnalyses();
  const [search, setSearch] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [compareAnalysisId, setCompareAnalysisId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Get positions for the analysis being compared
  const selectedAnalysis = analyses.find(a => a.id === (compareAnalysisId || selectedAnalysisId));
  const { positions: selectedPositions } = usePPAPositions(compareAnalysisId || selectedAnalysisId);

  const filteredAnalyses = analyses.filter(analysis =>
    analysis.project_name.toLowerCase().includes(search.toLowerCase()) ||
    analysis.document_file_name.toLowerCase().includes(search.toLowerCase()) ||
    (analysis.jurisdiction?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteAnalysis.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleCompareComplete = (newAnalysisId: string) => {
    setCompareAnalysisId(null);
    setSelectedAnalysisId(newAnalysisId);
  };

  // Show comparison upload
  if (compareAnalysisId && selectedAnalysis) {
    return (
      <PPACompareUpload
        parentAnalysis={selectedAnalysis}
        previousPositions={selectedPositions}
        onComplete={handleCompareComplete}
        onCancel={() => setCompareAnalysisId(null)}
      />
    );
  }

  // Show comparison report if the selected analysis is a comparison
  if (selectedAnalysisId && selectedAnalysis?.is_comparison) {
    return (
      <PPAComparisonReport
        analysis={selectedAnalysis}
        positions={selectedPositions}
        onBack={() => setSelectedAnalysisId(null)}
      />
    );
  }

  // Show regular report
  if (selectedAnalysisId) {
    return (
      <PPAAnalysisReport
        analysisId={selectedAnalysisId}
        onNewAnalysis={() => setSelectedAnalysisId(null)}
        onViewHistory={() => setSelectedAnalysisId(null)}
        onCompareNewDraft={() => setCompareAnalysisId(selectedAnalysisId)}
      />
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>View and manage your past PPA analyses</CardDescription>
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
          ) : filteredAnalyses.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? 'No analyses match your search' : 'No analyses yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a PPA document to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>PPA Structure</TableHead>
                  <TableHead>Perspective</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnalyses.map((analysis) => (
                  <TableRow key={analysis.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-medium"
                      onClick={() => setSelectedAnalysisId(analysis.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="flex items-center gap-2">
                            {analysis.project_name}
                            {analysis.is_comparison && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <GitCompare className="h-3 w-3" />
                                Comparison
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">{analysis.document_file_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      <Badge variant="outline">
                        {analysis.analysis_type === 'ppa_vs_bible' ? 'vs Bible' : 'vs Term Sheet'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {(analysis as any).ppa_type ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              {((analysis as any).ppa_type as string).toUpperCase()}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {PPA_STRUCTURE_LABELS[(analysis as any).ppa_type as PPAStructureType] || (analysis as any).ppa_type}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-xs text-muted-foreground">
                              —
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Re-analyze to classify PPA type
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      <Badge variant="secondary">
                        {analysis.perspective === 'buyer' ? 'Buyer' : 'Seller'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {analysis.jurisdiction || '-'}
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {analysis.is_agreed ? (
                        <Badge className="bg-green-100 text-green-800 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Agreed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {format(new Date(analysis.created_at), 'PP')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedAnalysisId(analysis.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Report
                          </DropdownMenuItem>
                          {!analysis.is_comparison && (
                            <DropdownMenuItem onClick={() => setCompareAnalysisId(analysis.id)}>
                              <GitCompare className="h-4 w-4 mr-2" />
                              Compare New Draft
                            </DropdownMenuItem>
                          )}
                          {onReanalyze && (
                            <DropdownMenuItem onClick={() => onReanalyze(analysis)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Re-analyze with Latest Engine
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirmId(analysis.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this analysis and all extracted positions.
              This action cannot be undone.
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
