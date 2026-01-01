import { useState, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssumptions, ASSUMPTION_LABELS, AssumptionLabel } from '@/lib/hooks/useAssumptions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Upload, 
  Plus, 
  Trash2, 
  Pencil, 
  Loader2, 
  FileText,
  Sparkles,
  Check,
  X
} from 'lucide-react';

interface AssumptionsSectionProps {
  matterId: string;
}

export interface ExtractedAssumption {
  label: string;
  assumption_text: string;
  selected: boolean;
}

// Color mapping for assumption labels
const labelColors: Record<string, string> = {
  "Document Revisions": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Transaction Scope": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "Negotiation Style": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "Timeline": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "Counterparty Cooperation": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "Jurisdiction": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "Due Diligence": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  "Third Party Involvement": "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "Regulatory Approvals": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  "Complexity Level": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  "Language": "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200",
  "Disputes": "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  "Financing Conditions": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  "Staffing": "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  "Other": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

// Export the label colors for use in other components
export { labelColors };

// Export a function to extract assumptions that can be reused
export async function extractAssumptionsFromText(text: string): Promise<ExtractedAssumption[]> {
  const { data, error } = await supabase.functions.invoke('extract-assumptions', {
    body: { text },
  });

  if (error) throw error;
  
  if (data.assumptions && data.assumptions.length > 0) {
    return data.assumptions.map((a: { label: string; assumption_text: string }) => ({
      ...a,
      selected: true, // Default all to selected
    }));
  }
  
  return [];
}

export function AssumptionsSection({ matterId }: AssumptionsSectionProps) {
  const { 
    assumptions, 
    isLoading, 
    createAssumption,
    createBulkAssumptions,
    updateAssumption, 
    deleteAssumption,
    deleteAllAssumptions,
  } = useAssumptions(matterId);

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [importTab, setImportTab] = useState<'upload' | 'paste'>('upload');
  const [importText, setImportText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [extractedAssumptions, setExtractedAssumptions] = useState<ExtractedAssumption[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Add/Edit form state
  const [newLabel, setNewLabel] = useState<AssumptionLabel>('Other');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<AssumptionLabel>('Other');
  const [editText, setEditText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    // Handle text files directly
    if (fileName.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImportText(text);
        setImportTab('paste');
      };
      reader.readAsText(file);
      return;
    }

    // Handle PDF and Word files via edge function
    if (fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      setIsUploadingFile(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document-text`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to extract text (${response.status})`);
        }

        const data = await response.json();
        if (data.text) {
          setImportText(data.text);
          setImportTab('paste');
          toast.success('Document text extracted successfully');
        } else {
          throw new Error('No text extracted from document');
        }
      } catch (error) {
        console.error('Error extracting document text:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to extract document text');
      } finally {
        setIsUploadingFile(false);
      }
      return;
    }

    toast.error('Unsupported file type. Please use PDF, DOCX, DOC, or TXT files.');
  };

  const handleExtractAssumptions = async () => {
    if (!importText.trim()) {
      toast.error('Please provide engagement letter text');
      return;
    }

    setIsExtracting(true);
    try {
      const extracted = await extractAssumptionsFromText(importText);
      
      if (extracted.length > 0) {
        setExtractedAssumptions(extracted);
        setShowPreview(true);
        toast.success(`Found ${extracted.length} assumptions`);
      } else {
        toast.info('No assumptions found in the document');
      }
    } catch (error) {
      console.error('Error extracting assumptions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract assumptions');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleAssumptionSelection = (index: number) => {
    setExtractedAssumptions(prev => 
      prev.map((a, i) => i === index ? { ...a, selected: !a.selected } : a)
    );
  };

  const selectAllAssumptions = () => {
    setExtractedAssumptions(prev => prev.map(a => ({ ...a, selected: true })));
  };

  const deselectAllAssumptions = () => {
    setExtractedAssumptions(prev => prev.map(a => ({ ...a, selected: false })));
  };

  const selectedCount = extractedAssumptions.filter(a => a.selected).length;

  const handleImportAssumptions = async () => {
    const selectedAssumptions = extractedAssumptions.filter(a => a.selected);
    if (selectedAssumptions.length === 0) {
      toast.error('Please select at least one assumption to import');
      return;
    }

    try {
      await createBulkAssumptions.mutateAsync(
        selectedAssumptions.map(a => ({
          label: a.label,
          assumption_text: a.assumption_text,
          source_document: 'Engagement Letter Import',
        }))
      );
      
      // Reset state
      setIsImportDialogOpen(false);
      setImportText('');
      setExtractedAssumptions([]);
      setShowPreview(false);
    } catch (error) {
      // Error handled in hook
    }
  };

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

          <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
            setIsImportDialogOpen(open);
            if (!open) {
              setImportText('');
              setExtractedAssumptions([]);
              setShowPreview(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Sparkles className="h-4 w-4 mr-1" />
                Import from EL
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Assumptions from Engagement Letter</DialogTitle>
                <DialogDescription>
                  Upload an engagement letter or paste its text to extract assumptions using AI
                </DialogDescription>
              </DialogHeader>
              
              {!showPreview ? (
                <>
                  <Tabs value={importTab} onValueChange={(v) => setImportTab(v as 'upload' | 'paste')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">
                        <Upload className="h-4 w-4 mr-1" />
                        Upload File
                      </TabsTrigger>
                      <TabsTrigger value="paste">
                        <FileText className="h-4 w-4 mr-1" />
                        Paste Text
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="space-y-4">
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                        {isUploadingFile ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Extracting text from document...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                              Choose File
                            </Button>
                            <p className="text-sm text-muted-foreground mt-2">
                              PDF, DOCX, DOC, or TXT (max 5MB)
                            </p>
                          </>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="paste" className="space-y-4">
                      <Textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste the engagement letter text here..."
                        rows={10}
                        className="font-mono text-sm"
                      />
                      {importText && (
                        <p className="text-xs text-muted-foreground">
                          {importText.length.toLocaleString()} characters
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleExtractAssumptions} 
                      disabled={!importText.trim() || isExtracting}
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Extract Assumptions
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h4 className="font-medium">
                          Found {extractedAssumptions.length} assumptions
                        </h4>
                        <span className="text-sm text-muted-foreground">
                          ({selectedCount} selected)
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={selectAllAssumptions}
                        >
                          Select All
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={deselectAllAssumptions}
                        >
                          Deselect All
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowPreview(false)}
                        >
                          Back to Text
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {extractedAssumptions.map((assumption, index) => (
                        <div 
                          key={index}
                          className={`border rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
                            assumption.selected 
                              ? 'bg-background border-primary/50' 
                              : 'bg-muted/30 border-muted opacity-60'
                          }`}
                          onClick={() => toggleAssumptionSelection(index)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox 
                              checked={assumption.selected}
                              onCheckedChange={() => toggleAssumptionSelection(index)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <Badge className={labelColors[assumption.label] || labelColors['Other']}>
                                {assumption.label}
                              </Badge>
                              <p className="text-sm">{assumption.assumption_text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPreview(false)}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleImportAssumptions}
                      disabled={createBulkAssumptions.isPending || selectedCount === 0}
                    >
                      {createBulkAssumptions.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Import {selectedCount} Assumption{selectedCount !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
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
            <p className="text-sm">Import from an engagement letter or add manually</p>
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
                <div className="space-y-1 ml-2">
                  {groupedAssumptions[label].map((assumption) => (
                    <div 
                      key={assumption.id}
                      className="group flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      {editingId === assumption.id ? (
                        <div className="flex-1 space-y-2">
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
                          <span className="flex-1 text-sm">{assumption.assumption_text}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
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
