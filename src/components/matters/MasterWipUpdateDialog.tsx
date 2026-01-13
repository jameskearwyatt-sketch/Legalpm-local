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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, FileText, CheckCircle, AlertTriangle, Info, X, Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency, getCurrencySymbol } from '@/lib/currencyUtils';
import { MatterWithFinancials } from '@/lib/hooks/useMatters';

interface ParsedMatterWip {
  matter_id: string;
  matter_name: string;
  client_name: string;
  wip_amount: number;
  wip_write_off: number;
  billed_amount: number;
  paid_amount: number;
  currency: string;
  confidence: 'high' | 'medium' | 'low';
  matched_text?: string;
}

interface EditableMatterWip extends ParsedMatterWip {
  status: 'pending' | 'accepted' | 'rejected' | 'editing';
  edited_wip_amount?: number;
  edited_wip_write_off?: number;
  edited_billed_amount?: number;
  edited_paid_amount?: number;
}

interface UnmatchedWipItem {
  description: string;
  wip_amount: number;
  billed_amount?: number;
  paid_amount?: number;
  reason: string;
}

interface MasterWipUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  matters: MatterWithFinancials[];
  onApplyUpdates: (updates: Array<{
    matter_id: string;
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    paid_amount: number;
  }>) => Promise<void>;
}

export function MasterWipUpdateDialog({
  isOpen,
  onClose,
  matters,
  onApplyUpdates,
}: MasterWipUpdateDialogProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('paste');
  const [pastedContent, setPastedContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editableMatches, setEditableMatches] = useState<EditableMatterWip[] | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedWipItem[]>([]);
  const [summary, setSummary] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setEditableMatches(null);
      setUnmatchedItems([]);
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
    setUnmatchedItems([]);
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

      // Build matters list for matching - use effective billing currency
      const mattersForMatching = matters.map(m => ({
        id: m.id,
        matter_name: m.matter_name,
        matter_display_name: (m as any).matter_display_name,
        matter_number: m.matter_number,
        client_name: m.clients?.name || '',
        client_display_name: m.clients?.display_name || '',
        cm_number: m.cm_number,
        // Use billing currency if different, otherwise quote/fee currency
        currency: (m as any).different_billing_currency && (m as any).billing_currency 
          ? (m as any).billing_currency 
          : (m as any).quote_currency || m.fee_currency,
      }));

      const { data, error } = await supabase.functions.invoke('parse-master-wip', {
        body: {
          content,
          matters: mattersForMatching,
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
      const matches: EditableMatterWip[] = (data.matches || []).map((m: ParsedMatterWip) => ({
        ...m,
        status: 'pending' as const,
      }));
      
      setEditableMatches(matches);
      setUnmatchedItems(data.unmatched_items || []);
      setSummary(data.summary || '');

      if (matches.length > 0 || (data.unmatched_items || []).length > 0) {
        toast.success(`Found ${matches.length} matter matches - review below`);
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

  const updateMatch = (index: number, updates: Partial<EditableMatterWip>) => {
    setEditableMatches(prev => 
      prev?.map((m, i) => i === index ? { ...m, ...updates } : m) || null
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

  const handleApply = async () => {
    if (!editableMatches) return;

    const acceptedUpdates = editableMatches
      .filter(m => m.status === 'accepted')
      .map(m => ({
        matter_id: m.matter_id,
        wip_amount: m.edited_wip_amount ?? m.wip_amount,
        wip_write_off_amount: m.edited_wip_write_off ?? m.wip_write_off,
        billed_amount: m.edited_billed_amount ?? m.billed_amount,
        paid_amount: m.edited_paid_amount ?? m.paid_amount,
      }));

    if (acceptedUpdates.length === 0) {
      toast.error('No items accepted - please accept at least one item');
      return;
    }

    try {
      await onApplyUpdates(acceptedUpdates);
      handleClose();
      toast.success(`Applied WIP updates for ${acceptedUpdates.length} matters`);
    } catch (error) {
      toast.error('Failed to apply updates');
    }
  };

  const handleClose = () => {
    setPastedContent('');
    setUploadedFile(null);
    setEditableMatches(null);
    setUnmatchedItems([]);
    setSummary('');
    setEditingIndex(null);
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Master WIP Update
          </DialogTitle>
          <DialogDescription>
            Upload a document or paste WIP/AR/Paid information for multiple matters. 
            The AI will match entries to matters and suggest updates.
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
                  placeholder="Paste your WIP information here... This can be from an email, spreadsheet, report, or any document that contains WIP/AR/Paid amounts for multiple matters."
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
                <strong>Note:</strong> All amounts should be in the matter's <strong>billing currency</strong>. 
                For matters with different estimate/billing currencies, amounts will be recorded in the billing currency.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleProcess} 
                disabled={isProcessing || (!pastedContent.trim() && !uploadedFile)}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Document'
                )}
              </Button>
            </DialogFooter>
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
                    Matched Matters ({editableMatches.length})
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
                <div className="divide-y max-h-[400px] overflow-y-auto">
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{match.client_name}</span>
                            <span className="text-muted-foreground">-</span>
                            <span className="text-sm text-muted-foreground truncate">{match.matter_name}</span>
                          </div>
                          
                          {editingIndex === index ? (
                            <div className="grid grid-cols-4 gap-3 p-3 bg-muted/30 rounded-lg">
                              <div>
                                <Label className="text-xs">WIP ({getCurrencySymbol(match.currency).trim()})</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={match.edited_wip_amount ?? match.wip_amount}
                                  onChange={(e) => updateMatch(index, { edited_wip_amount: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Write-off ({getCurrencySymbol(match.currency).trim()})</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={match.edited_wip_write_off ?? match.wip_write_off}
                                  onChange={(e) => updateMatch(index, { edited_wip_write_off: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Billed/AR ({getCurrencySymbol(match.currency).trim()})</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={match.edited_billed_amount ?? match.billed_amount}
                                  onChange={(e) => updateMatch(index, { edited_billed_amount: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Paid ({getCurrencySymbol(match.currency).trim()})</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={match.edited_paid_amount ?? match.paid_amount}
                                  onChange={(e) => updateMatch(index, { edited_paid_amount: parseFloat(e.target.value) || 0 })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="col-span-4 flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>
                                  Done
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 text-sm">
                              <span>
                                <span className="text-muted-foreground">WIP:</span>{' '}
                                <span className="font-medium">{formatCurrency(match.edited_wip_amount ?? match.wip_amount, match.currency)}</span>
                              </span>
                              {(match.wip_write_off > 0 || (match.edited_wip_write_off ?? 0) > 0) && (
                                <span className="text-destructive">
                                  <span className="text-muted-foreground">W/O:</span>{' '}
                                  <span className="font-medium">{formatCurrency(match.edited_wip_write_off ?? match.wip_write_off, match.currency)}</span>
                                </span>
                              )}
                              <span>
                                <span className="text-muted-foreground">AR:</span>{' '}
                                <span className="font-medium">{formatCurrency(match.edited_billed_amount ?? match.billed_amount, match.currency)}</span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Paid:</span>{' '}
                                <span className="font-medium text-success">{formatCurrency(match.edited_paid_amount ?? match.paid_amount, match.currency)}</span>
                              </span>
                            </div>
                          )}
                          
                          {match.matched_text && (
                            <p className="text-xs text-muted-foreground italic">
                              Matched from: "{match.matched_text}"
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {match.status !== 'editing' && editingIndex !== index && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingIndex(index)}
                              title="Edit values"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn("h-7 w-7", match.status === 'accepted' && "text-green-600")}
                            onClick={() => updateMatch(index, { status: match.status === 'accepted' ? 'pending' : 'accepted' })}
                            title={match.status === 'accepted' ? "Undo accept" : "Accept"}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn("h-7 w-7", match.status === 'rejected' && "text-red-500")}
                            onClick={() => updateMatch(index, { status: match.status === 'rejected' ? 'pending' : 'rejected' })}
                            title={match.status === 'rejected' ? "Undo reject" : "Reject"}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Items */}
            {unmatchedItems.length > 0 && (
              <div className="border rounded-lg overflow-hidden border-amber-200 dark:border-amber-800">
                <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2">
                  <span className="font-medium text-sm text-amber-800 dark:text-amber-200">
                    Unmatched Items ({unmatchedItems.length})
                  </span>
                </div>
                <div className="divide-y max-h-[200px] overflow-y-auto">
                  {unmatchedItems.map((item, index) => (
                    <div key={index} className="px-4 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{item.description}</span>
                        <span className="font-medium">{formatCurrency(item.wip_amount, 'GBP')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setEditableMatches(null)}>
                Back to Upload
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {acceptedCount} item{acceptedCount !== 1 ? 's' : ''} selected
                </span>
                <Button onClick={handleApply} disabled={acceptedCount === 0}>
                  Apply Updates
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
