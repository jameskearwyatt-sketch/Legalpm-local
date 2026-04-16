import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileText, CheckCircle, AlertTriangle, Info, X, Check, Edit2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BudgetLineItem {
  id: string;
  work_item: string;
  category: string | null;
  fee_amount: number;
  provider: string;
  lc_firm_name: string | null;
}

interface ParsedWipMatch {
  budget_line_item_id: string;
  work_item: string;
  wip_amount: number;
  confidence: 'high' | 'medium' | 'low';
  matched_text?: string;
}

interface EditableMatch extends ParsedWipMatch {
  status: 'pending' | 'accepted' | 'rejected' | 'editing';
  edited_amount?: number;
  edited_budget_line_item_id?: string;
}

interface UnmatchedItem {
  description: string;
  amount: number;
  reason: string;
}

interface EditableUnmatched extends UnmatchedItem {
  status: 'pending' | 'assigned' | 'rejected';
  assigned_budget_line_item_id?: string;
  edited_amount?: number;
}

interface WipImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMatches: (matches: ParsedWipMatch[]) => void;
  budgetLineItems: BudgetLineItem[];
  currency: string;
  formatCurrency: (value: number, currency?: string) => string;
}

export function WipImportDialog({
  isOpen,
  onClose,
  onApplyMatches,
  budgetLineItems,
  currency,
  formatCurrency,
}: WipImportDialogProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [pastedContent, setPastedContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editableMatches, setEditableMatches] = useState<EditableMatch[] | null>(null);
  const [editableUnmatched, setEditableUnmatched] = useState<EditableUnmatched[]>([]);
  const [summary, setSummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setEditableMatches(null);
      setEditableUnmatched([]);
      setSummary('');
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await file.text();
    }
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || 
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel') {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const arrayBuffer = await file.arrayBuffer();
      await workbook.xlsx.load(arrayBuffer);
      
      let textContent = '';
      workbook.eachSheet((sheet) => {
        textContent += `\n--- Sheet: ${sheet.name} ---\n`;
        sheet.eachRow((row) => {
          const rowValues = row.values;
          if (!Array.isArray(rowValues)) return;
          
          const cellStrings: string[] = [];
          for (let i = 1; i < rowValues.length; i++) {
            const cell = rowValues[i];
            if (cell == null) {
              cellStrings.push('');
            } else if (typeof cell === 'object' && cell !== null && 'result' in cell) {
              cellStrings.push(String((cell as { result: unknown }).result));
            } else if (typeof cell === 'object') {
              cellStrings.push('');
            } else {
              cellStrings.push(String(cell));
            }
          }
          
          const rowText = cellStrings.join('\t');
          if (rowText.trim()) {
            textContent += rowText + '\n';
          }
        });
      });
      
      return textContent;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    const { data, error } = await supabase.functions.invoke('parse-document-text', {
      body: formData,
    });
    
    if (error) throw error;
    return data.text || '';
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setEditableMatches(null);
    setEditableUnmatched([]);
    setSummary('');

    try {
      let content = '';

      if (activeTab === 'paste') {
        if (!pastedContent.trim()) {
          toast.error('Please paste some WIP information');
          return;
        }
        content = pastedContent;
      } else {
        if (!uploadedFile) {
          toast.error('Please upload a file');
          return;
        }
        
        toast.loading('Extracting text from document...');
        try {
          content = await extractTextFromFile(uploadedFile);
          toast.dismiss();
        } catch (err) {
          toast.dismiss();
          toast.error('Failed to extract text from document');
          console.error('Text extraction error:', err);
          return;
        }
      }

      if (!content.trim()) {
        toast.error('No content to process');
        return;
      }

      const { data, error } = await supabase.functions.invoke('parse-wip-document', {
        body: {
          content,
          budgetLineItems: budgetLineItems.map(item => ({
            id: item.id,
            work_item: item.work_item,
            category: item.category,
            fee_amount: item.fee_amount,
            provider: item.provider,
            lc_firm_name: item.lc_firm_name,
          })),
          currency,
        },
      });

      if (error) {
        console.error('Parse error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse WIP document');
      }

      // Convert to editable matches with pending status
      const matches: EditableMatch[] = (data.matches || []).map((m: ParsedWipMatch) => ({
        ...m,
        status: 'pending' as const,
      }));
      
      const unmatched: EditableUnmatched[] = (data.unmatched_items || []).map((u: UnmatchedItem) => ({
        ...u,
        status: 'pending' as const,
      }));

      setEditableMatches(matches);
      setEditableUnmatched(unmatched);
      setSummary(data.summary || '');

      if (matches.length > 0 || unmatched.length > 0) {
        toast.success(`Found ${matches.length} matches and ${unmatched.length} unmatched items - review below`);
      } else {
        toast.warning('No WIP items found in the document');
      }

    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process WIP information');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMatch = (index: number, updates: Partial<EditableMatch>) => {
    setEditableMatches(prev => 
      prev?.map((m, i) => i === index ? { ...m, ...updates } : m) || null
    );
  };

  const updateUnmatched = (index: number, updates: Partial<EditableUnmatched>) => {
    setEditableUnmatched(prev => 
      prev.map((u, i) => i === index ? { ...u, ...updates } : u)
    );
  };

  const acceptAll = () => {
    setEditableMatches(prev => 
      prev?.map(m => ({ ...m, status: 'accepted' as const })) || null
    );
  };

  const rejectAll = () => {
    setEditableMatches(prev => 
      prev?.map(m => ({ ...m, status: 'rejected' as const })) || null
    );
  };

  const handleApply = () => {
    if (!editableMatches) return;

    // Build final matches from accepted items
    const acceptedMatches: ParsedWipMatch[] = editableMatches
      .filter(m => m.status === 'accepted')
      .map(m => ({
        budget_line_item_id: m.edited_budget_line_item_id || m.budget_line_item_id,
        work_item: budgetLineItems.find(b => b.id === (m.edited_budget_line_item_id || m.budget_line_item_id))?.work_item || m.work_item,
        wip_amount: m.edited_amount ?? m.wip_amount,
        confidence: m.confidence,
        matched_text: m.matched_text,
      }));

    // Add assigned unmatched items
    const assignedUnmatched: ParsedWipMatch[] = editableUnmatched
      .filter(u => u.status === 'assigned' && u.assigned_budget_line_item_id)
      .map(u => ({
        budget_line_item_id: u.assigned_budget_line_item_id!,
        work_item: budgetLineItems.find(b => b.id === u.assigned_budget_line_item_id)?.work_item || u.description,
        wip_amount: u.edited_amount ?? u.amount,
        confidence: 'low' as const,
        matched_text: u.description,
      }));

    const allMatches = [...acceptedMatches, ...assignedUnmatched];

    if (allMatches.length === 0) {
      toast.error('No items accepted - please accept at least one item');
      return;
    }

    onApplyMatches(allMatches);
    handleClose();
    toast.success(`Applied ${allMatches.length} WIP updates`);
  };

  const handleClose = () => {
    setPastedContent('');
    setUploadedFile(null);
    setEditableMatches(null);
    setEditableUnmatched([]);
    setSummary('');
    onClose();
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-red-600 dark:text-red-400';
    }
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'medium': return <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'low': return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const acceptedCount = editableMatches?.filter(m => m.status === 'accepted').length || 0;
  const assignedCount = editableUnmatched.filter(u => u.status === 'assigned').length;
  const totalApplyCount = acceptedCount + assignedCount;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import WIP Information
          </DialogTitle>
          <DialogDescription>
            Upload a document or paste WIP information. Review and accept/reject each extracted item.
          </DialogDescription>
        </DialogHeader>

        {!editableMatches ? (
          <>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'upload')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="mt-4">
                <Textarea
                  value={pastedContent}
                  onChange={(e) => setPastedContent(e.target.value)}
                  placeholder="Paste your WIP information here... This can be from an email, spreadsheet, report, or any document that contains WIP amounts for the work items."
                  className="min-h-[200px] font-mono text-sm"
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    uploadedFile
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.pdf,.doc,.docx,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {uploadedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-primary" />
                      <p className="font-medium">{uploadedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">
                        Supports PDF, DOC, DOCX, XLS, XLSX, TXT files
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                The AI will aggressively extract ALL monetary values and propose matches. You can then accept, reject, or edit each item individually.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            {summary && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">{summary}</AlertDescription>
              </Alert>
            )}

            {/* Matched Items */}
            {editableMatches.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                  <span className="font-medium text-sm">
                    Matched Items ({editableMatches.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={acceptAll} className="h-7 text-xs">
                      <Check className="h-3 w-3 mr-1" /> Accept All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={rejectAll} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" /> Reject All
                    </Button>
                  </div>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {editableMatches.map((match, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        'px-4 py-3 transition-colors',
                        match.status === 'accepted' && 'bg-green-50 dark:bg-green-950/20',
                        match.status === 'rejected' && 'bg-red-50 dark:bg-red-950/20 opacity-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status/Confidence indicator */}
                        <div className="flex-shrink-0 pt-0.5">
                          {match.status === 'accepted' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : match.status === 'rejected' ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : (
                            getConfidenceIcon(match.confidence)
                          )}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {match.status === 'editing' ? (
                            <>
                              {/* Editing mode */}
                              <Select
                                value={match.edited_budget_line_item_id || match.budget_line_item_id}
                                onValueChange={(value) => updateMatch(index, { edited_budget_line_item_id: value })}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {budgetLineItems.map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.work_item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Amount:</span>
                                <Input
                                  type="number"
                                  value={match.edited_amount ?? match.wip_amount}
                                  onChange={(e) => updateMatch(index, { edited_amount: parseFloat(e.target.value) || 0 })}
                                  className="h-8 w-32 text-sm"
                                />
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  className="h-8"
                                  onClick={() => updateMatch(index, { status: 'accepted' })}
                                >
                                  <Check className="h-3 w-3 mr-1" /> Confirm
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => updateMatch(index, { status: 'pending', edited_amount: undefined, edited_budget_line_item_id: undefined })}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Display mode */}
                              <p className="text-sm font-medium">{match.work_item}</p>
                              {match.matched_text && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  Matched: "{match.matched_text}"
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Amount and actions */}
                        {match.status !== 'editing' && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold">
                                {formatCurrency(match.edited_amount ?? match.wip_amount, currency)}
                              </p>
                              <p className={cn('text-xs capitalize', getConfidenceColor(match.confidence))}>
                                {match.confidence}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {match.status === 'pending' && (
                                <>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => updateMatch(index, { status: 'accepted' })}
                                    title="Accept"
                                  >
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => updateMatch(index, { status: 'editing' })}
                                    title="Edit"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7"
                                    onClick={() => updateMatch(index, { status: 'rejected' })}
                                    title="Reject"
                                  >
                                    <X className="h-4 w-4 text-red-500" />
                                  </Button>
                                </>
                              )}
                              {(match.status === 'accepted' || match.status === 'rejected') && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => updateMatch(index, { status: 'pending' })}
                                  title="Undo"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Items */}
            {editableUnmatched.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 font-medium text-sm text-amber-800 dark:text-amber-300">
                  Unmatched Items ({editableUnmatched.length}) - Assign to budget items or reject
                </div>
                <div className="divide-y max-h-[200px] overflow-y-auto">
                  {editableUnmatched.map((item, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        'px-4 py-3 transition-colors',
                        item.status === 'assigned' && 'bg-green-50 dark:bg-green-950/20',
                        item.status === 'rejected' && 'bg-red-50 dark:bg-red-950/20 opacity-50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                          
                          {item.status === 'pending' && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select
                                value={item.assigned_budget_line_item_id || ''}
                                onValueChange={(value) => updateUnmatched(index, { 
                                  assigned_budget_line_item_id: value,
                                  status: 'assigned' 
                                })}
                              >
                                <SelectTrigger className="h-8 text-sm w-[200px]">
                                  <SelectValue placeholder="Assign to budget item..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {budgetLineItems.map(b => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.work_item}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                value={item.edited_amount ?? item.amount}
                                onChange={(e) => updateUnmatched(index, { edited_amount: parseFloat(e.target.value) || 0 })}
                                className="h-8 w-24 text-sm"
                              />
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8"
                                onClick={() => updateUnmatched(index, { status: 'rejected' })}
                              >
                                <X className="h-3 w-3 mr-1" /> Reject
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-sm font-medium">
                            {formatCurrency(item.edited_amount ?? item.amount, currency)}
                          </p>
                          {(item.status === 'assigned' || item.status === 'rejected') && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7"
                              onClick={() => updateUnmatched(index, { status: 'pending', assigned_budget_line_item_id: undefined })}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editableMatches.length === 0 && editableUnmatched.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No WIP items could be extracted from the provided content.
                  Try providing more detailed information.
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setEditableMatches(null);
                setEditableUnmatched([]);
                setSummary('');
              }}
              className="w-full"
            >
              Try Again with Different Content
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          {!editableMatches ? (
            <Button
              onClick={handleProcess}
              disabled={isProcessing || (activeTab === 'paste' ? !pastedContent.trim() : !uploadedFile)}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Analyze WIP'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={totalApplyCount === 0}
            >
              Apply {totalApplyCount} Item{totalApplyCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}