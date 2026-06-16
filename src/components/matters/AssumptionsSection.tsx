import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAssumptions, ASSUMPTION_LABELS, AssumptionLabel } from '@/lib/hooks/useAssumptions';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  FileText,
  Check,
  X
} from 'lucide-react';

interface AssumptionsSectionProps {
  matterId: string;
}

// Color mapping for assumption labels - updated for new categories
const labelColors: Record<string, string> = {
  "Document Drafting": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Document Negotiation": "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  "Transaction Structure": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Transaction Timeline": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Due Diligence Scope": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Counterparty Conduct": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Third Party Approvals": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Regulatory & Compliance": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Jurisdiction & Governing Law": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Financing Arrangements": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "Disputes & Litigation": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "Staffing & Resourcing": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "Client Responsibilities": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Excluded Work": "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  "Other": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

// Export the label colors for use in other components
export { labelColors };

export function AssumptionsSection({ matterId }: AssumptionsSectionProps) {
  const {
    assumptions,
    isLoading,
    createAssumption,
    updateAssumption,
    deleteAssumption,
    deleteAllAssumptions,
  } = useAssumptions(matterId);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Add/Edit form state
  const [newLabel, setNewLabel] = useState<AssumptionLabel>('Other');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<AssumptionLabel>('Other');
  const [editText, setEditText] = useState('');

  const handleAddAssumption = async () => {
    if (!newText.trim()) {
      toast.error('Please enter assumption text');
      return;
    }

    try {
      await createAssumption.mutateAsync({
        matter_id: matterId,
        label: newLabel,
        assumption_text: newText.trim(),
      });

      setIsAddDialogOpen(false);
      setNewLabel('Other');
      setNewText('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const startEditing = (assumption: { id: string; label: string; assumption_text: string }) => {
    setEditingId(assumption.id);
    setEditLabel(assumption.label as AssumptionLabel);
    setEditText(assumption.assumption_text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditLabel('Other');
    setEditText('');
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;

    try {
      await updateAssumption.mutateAsync({
        id: editingId,
        label: editLabel,
        assumption_text: editText.trim(),
      });
      cancelEditing();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllAssumptions.mutateAsync();
      toast.success('All assumptions cleared');
    } catch (error) {
      // Error handled in hook
    }
  };

  // Group assumptions by label
  const groupedAssumptions = assumptions.reduce((acc, assumption) => {
    const label = assumption.label;
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(assumption);
    return acc;
  }, {} as Record<string, typeof assumptions>);

  const sortedLabels = Object.keys(groupedAssumptions).sort((a, b) => {
    const indexA = ASSUMPTION_LABELS.indexOf(a as AssumptionLabel);
    const indexB = ASSUMPTION_LABELS.indexOf(b as AssumptionLabel);
    return indexA - indexB;
  });

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-heading">Assumptions</CardTitle>
          <CardDescription>
            Key assumptions underlying the fee estimate from the engagement letter
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {assumptions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all assumptions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all {assumptions.length} assumptions. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Assumption</DialogTitle>
                <DialogDescription>
                  Add a new assumption for this matter
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label</label>
                  <Select value={newLabel} onValueChange={(v) => setNewLabel(v as AssumptionLabel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSUMPTION_LABELS.map((label) => (
                        <SelectItem key={label} value={label}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assumption Text</label>
                  <Textarea
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Enter the assumption..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddAssumption} disabled={createAssumption.isPending}>
                  {createAssumption.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Add Assumption
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assumptions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No assumptions recorded yet</p>
            <p className="text-sm">Add assumptions manually</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLabels.map((label) => (
              <div key={label} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={labelColors[label] || labelColors['Other']}>
                    {label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ({groupedAssumptions[label].length})
                  </span>
                </div>
                <div className="ml-2">
                  {/* Column header row */}
                  <div className="flex items-center gap-2 px-2 py-1 border-b text-xs text-muted-foreground font-medium">
                    <div className="w-16 text-center shrink-0">Exceeded?</div>
                    <div className="flex-1">Assumption</div>
                    <div className="w-14"></div>
                  </div>
                  {/* Assumption rows */}
                  {groupedAssumptions[label].map((assumption) => (
                    <div
                      key={assumption.id}
                      className="group flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      {editingId === assumption.id ? (
                        <div className="flex-1 space-y-2 ml-18">
                          <Select value={editLabel} onValueChange={(v) => setEditLabel(v as AssumptionLabel)}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSUMPTION_LABELS.map((l) => (
                                <SelectItem key={l} value={l}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={saveEdit} disabled={updateAssumption.isPending}>
                              {updateAssumption.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-16 flex justify-center shrink-0">
                            <Checkbox
                              checked={assumption.is_exceeded}
                              onCheckedChange={(checked) => {
                                updateAssumption.mutate({
                                  id: assumption.id,
                                  is_exceeded: checked === true,
                                });
                              }}
                            />
                          </div>
                          <span className={`flex-1 text-sm ${assumption.is_exceeded ? 'text-red-600 dark:text-red-400' : ''}`}>
                            {assumption.assumption_text}
                          </span>
                          <div className="w-14 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => startEditing(assumption)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => deleteAssumption.mutate(assumption.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
