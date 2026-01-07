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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText, CheckCircle, AlertTriangle, Info } from 'lucide-react';
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

interface UnmatchedItem {
  description: string;
  amount: number;
  reason: string;
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
  const [parsedMatches, setParsedMatches] = useState<ParsedWipMatch[] | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedItem[]>([]);
  const [summary, setSummary] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Reset any previous results
      setParsedMatches(null);
      setUnmatchedItems([]);
      setSummary('');
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For text files, read directly
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await file.text();
    }
    
    // For Excel files, use exceljs to parse
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
          
          // Process each cell, skipping the first (exceljs uses 1-based indexing)
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
    
    // For other document types, use the parse-document-text edge function
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
    setParsedMatches(null);
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

      console.log('Processing WIP content, length:', content.length);

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

      setParsedMatches(data.matches || []);
      setUnmatchedItems(data.unmatched_items || []);
      setSummary(data.summary || '');

      if (data.matches?.length > 0) {
        toast.success(`Found ${data.matches.length} WIP matches`);
      } else {
        toast.warning('No matching WIP items found');
      }

    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process WIP information');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (parsedMatches && parsedMatches.length > 0) {
      onApplyMatches(parsedMatches);
      handleClose();
    }
  };

  const handleClose = () => {
    setPastedContent('');
    setUploadedFile(null);
    setParsedMatches(null);
    setUnmatchedItems([]);
    setSummary('');
    onClose();
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'text-green-600 dark:text-green-400';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400';
      case 'low':
        return 'text-red-600 dark:text-red-400';
    }
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'medium':
        return <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'low':
        return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import WIP Information
          </DialogTitle>
          <DialogDescription>
            Upload a document or paste WIP information to automatically populate the WIP amounts
          </DialogDescription>
        </DialogHeader>

        {!parsedMatches ? (
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
                The AI will analyze your content and match WIP amounts to the existing budget line items.
                It works best with clear, structured information but can handle various formats including
                tables, lists, emails, and summaries.
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
            {parsedMatches.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 font-medium text-sm flex items-center justify-between">
                  <span>Matched WIP Items ({parsedMatches.length})</span>
                  <span className="text-xs text-muted-foreground">
                    Total: {formatCurrency(parsedMatches.reduce((sum, m) => sum + m.wip_amount, 0), currency)}
                  </span>
                </div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                  {parsedMatches.map((match, index) => (
                    <div key={index} className="px-4 py-3 flex items-start gap-3">
                      {getConfidenceIcon(match.confidence)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{match.work_item}</p>
                        {match.matched_text && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            "{match.matched_text}"
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{formatCurrency(match.wip_amount, currency)}</p>
                        <p className={cn('text-xs capitalize', getConfidenceColor(match.confidence))}>
                          {match.confidence} confidence
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Items */}
            {unmatchedItems.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 font-medium text-sm text-amber-800 dark:text-amber-300">
                  Unmatched Items ({unmatchedItems.length})
                </div>
                <div className="divide-y max-h-[150px] overflow-y-auto">
                  {unmatchedItems.map((item, index) => (
                    <div key={index} className="px-4 py-2 flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.reason}</p>
                      </div>
                      <p className="text-sm font-medium flex-shrink-0">
                        {formatCurrency(item.amount, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedMatches.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No matching WIP items could be found in the provided content.
                  Try providing more detailed information or manually entering the values.
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setParsedMatches(null);
                setUnmatchedItems([]);
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
          {!parsedMatches ? (
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
              disabled={parsedMatches.length === 0}
            >
              Apply {parsedMatches.length} Matches
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
