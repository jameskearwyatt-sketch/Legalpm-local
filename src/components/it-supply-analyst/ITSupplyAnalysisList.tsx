import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, MoreHorizontal, Eye, Trash2, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useITSupplyAnalyses } from '@/lib/hooks/useITSupplyAnalyses';
import { IT_SUPPLY_TYPES } from '@/lib/itSupplyCategories';
import { format } from 'date-fns';
import { ITSupplyAnalysisReport } from './ITSupplyAnalysisReport';

export function ITSupplyAnalysisList() {
  const { analyses, isLoading, deleteAnalysis } = useITSupplyAnalyses();
  const [search, setSearch] = useState('');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredAnalyses = analyses.filter(a =>
    a.project_name.toLowerCase().includes(search.toLowerCase()) ||
    a.document_file_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.jurisdiction?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteAnalysis.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  if (selectedAnalysisId) {
    return <ITSupplyAnalysisReport analysisId={selectedAnalysisId} onNewAnalysis={() => setSelectedAnalysisId(null)} onViewHistory={() => setSelectedAnalysisId(null)} />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Analysis History</CardTitle>
              <CardDescription>View and manage your past IT supply contract analyses</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search analyses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredAnalyses.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{search ? 'No analyses match your search' : 'No analyses yet'}</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a supply contract to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Supply Type</TableHead>
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
                    <TableCell className="font-medium" onClick={() => setSelectedAnalysisId(analysis.id)}>
                      <div>
                        <p>{analysis.project_name}</p>
                        <p className="text-xs text-muted-foreground">{analysis.document_file_name}</p>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      <Badge variant="outline">{analysis.analysis_type === 'contract_vs_bible' ? 'vs Knowledge' : 'vs Term Sheet'}</Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {analysis.supply_type ? <Badge variant="outline" className="text-xs">{IT_SUPPLY_TYPES.find(t => t.id === analysis.supply_type)?.label || analysis.supply_type}</Badge> : '—'}
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      <Badge variant="secondary">{analysis.perspective === 'buyer' ? 'Buyer' : 'Supplier'}</Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>{analysis.jurisdiction || '-'}</TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>
                      {analysis.is_agreed ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" /> Agreed</Badge> : <Badge variant="secondary">Draft</Badge>}
                    </TableCell>
                    <TableCell onClick={() => setSelectedAnalysisId(analysis.id)}>{format(new Date(analysis.created_at), 'PP')}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedAnalysisId(analysis.id)}><Eye className="h-4 w-4 mr-2" /> View Report</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmId(analysis.id)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Analysis?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this analysis and all extracted positions.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
