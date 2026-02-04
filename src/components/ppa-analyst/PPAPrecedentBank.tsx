import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Search, Database, Trash2, Filter, Loader2 } from 'lucide-react';
import { usePPAPrecedentBank } from '@/lib/hooks/usePPAAnalyses';
import { PPA_ALL_CATEGORIES, PPA_CATEGORY_GROUPS } from '@/lib/ppaCategories';
import { format } from 'date-fns';

export function PPAPrecedentBank() {
  const { precedents, isLoading, deletePrecedent } = usePPAPrecedentBank();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [perspectiveFilter, setPerspectiveFilter] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredPrecedents = useMemo(() => {
    return precedents.filter(p => {
      const matchesSearch = 
        p.position_summary.toLowerCase().includes(search.toLowerCase()) ||
        p.project_name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchesPerspective = perspectiveFilter === 'all' || p.perspective === perspectiveFilter;
      
      return matchesSearch && matchesCategory && matchesPerspective;
    });
  }, [precedents, search, categoryFilter, perspectiveFilter]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const p of precedents) {
      stats[p.category] = (stats[p.category] || 0) + 1;
    }
    return stats;
  }, [precedents]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(precedents.map(p => p.category))].sort();
  }, [precedents]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePrecedent.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Precedent Bank
              </CardTitle>
              <CardDescription>
                Your library of banked positions from agreed PPAs
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {precedents.length} precedents
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search precedents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat} ({categoryStats[cat] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={perspectiveFilter} onValueChange={setPerspectiveFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Perspective" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="seller">Seller</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Summary */}
          {precedents.length >= 5 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Category Distribution</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryStats)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([category, count]) => {
                    const percentage = Math.round((count / precedents.length) * 100);
                    return (
                      <Badge 
                        key={category} 
                        variant="outline" 
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => setCategoryFilter(category)}
                      >
                        {category}: {precedents.length > 5 ? `${percentage}%` : count}
                      </Badge>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPrecedents.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search || categoryFilter !== 'all' || perspectiveFilter !== 'all'
                  ? 'No precedents match your filters'
                  : 'No precedents banked yet'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Mark PPAs as agreed and bank positions to build your library
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[40%]">Position</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Perspective</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Banked</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrecedents.map((precedent) => (
                  <TableRow key={precedent.id}>
                    <TableCell>
                      <Badge variant="outline">{precedent.category}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {precedent.position_summary}
                    </TableCell>
                    <TableCell className="font-medium">
                      {precedent.project_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {precedent.perspective === 'buyer' ? 'Buyer' : 'Seller'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {precedent.jurisdiction || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(precedent.banked_at), 'PP')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmId(precedent.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
            <AlertDialogTitle>Remove Precedent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this position from your precedent bank.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
