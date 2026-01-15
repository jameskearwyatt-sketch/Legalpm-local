import { useState, useRef, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileText, AlertTriangle, Brain, Settings2, Search, ChevronDown, ChevronRight, Link2, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currencyUtils';
import { MatterWithFinancials } from '@/lib/hooks/useMatters';
import { useReportFormats, ColumnMappings } from '@/lib/hooks/useReportFormats';
import { useReportMatterMappings } from '@/lib/hooks/useReportMatterMappings';
import { ReportFormatTrainingDialog } from './ReportFormatTrainingDialog';

interface MasterWipUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  matters: MatterWithFinancials[];
  onApplyUpdates: (updates: Array<{
    matter_id: string;
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
  }>) => Promise<void>;
}

interface ImportedMatterData {
  rowIndex: number;
  matterNumber: string;
  matterName: string;
  clientName?: string;
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  needsConfirmation?: boolean;
  currency: string;
  wip: { value: number; current: number; changed: boolean; selected: boolean };
  accountsReceivable: { value: number; current: number; changed: boolean; selected: boolean };
  totalBilled: { value: number; current: number; changed: boolean; selected: boolean };
  totalPaid: { value: number; current: number; changed: boolean; selected: boolean };
  selected: boolean;
}

type Step = 'upload' | 'training' | 'confirm-matches' | 'review';

export function MasterWipUpdateDialog({
  isOpen,
  onClose,
  matters,
  onApplyUpdates,
}: MasterWipUpdateDialogProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload'>('upload');
  const [pastedContent, setPastedContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  
  // Training state
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  
  // Review state
  const [importedData, setImportedData] = useState<ImportedMatterData[]>([]);
  const [unmatchedData, setUnmatchedData] = useState<ImportedMatterData[]>([]);
  const [lowConfidenceData, setLowConfidenceData] = useState<ImportedMatterData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { format, isLoading: formatLoading, saveFormat, deleteFormat, checkFormatMatch, createHeaderSignature } = useReportFormats();
  const { mappings: savedMappings, saveMapping, isLoading: mappingsLoading } = useReportMatterMappings();
  const [showFormatDetails, setShowFormatDetails] = useState(false);
  const [isDeletingFormat, setIsDeletingFormat] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setImportedData([]);
      setUnmatchedData([]);
      setParsedHeaders([]);
      setParsedRows([]);
    }
  };

  const parseExcelFile = async (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    
    let headers: string[] = [];
    const rows: string[][] = [];
    let isFirstRow = true;
    
    workbook.eachSheet((sheet) => {
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
        
        if (isFirstRow && cellStrings.some(c => c.trim())) {
          headers = cellStrings;
          isFirstRow = false;
        } else if (cellStrings.some(c => c.trim())) {
          rows.push(cellStrings);
        }
      });
    });
    
    return { headers, rows };
  };

  const handleProcess = async () => {
    setIsProcessing(true);

    try {
      let headers: string[] = [];
      let rows: string[][] = [];

      if (activeTab === 'upload') {
        if (!uploadedFile) {
          toast.error('Please upload a file');
          return;
        }
        
        if (uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls')) {
          const parsed = await parseExcelFile(uploadedFile);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          toast.error('Please upload an Excel file (.xlsx or .xls)');
          return;
        }
      } else {
        // Parse pasted content as tab-separated
        if (!pastedContent.trim()) {
          toast.error('Please paste some data');
          return;
        }
        const lines = pastedContent.trim().split('\n');
        if (lines.length < 2) {
          toast.error('Need at least a header row and one data row');
          return;
        }
        headers = lines[0].split('\t');
        rows = lines.slice(1).map(line => line.split('\t'));
      }

      if (headers.length === 0 || rows.length === 0) {
        toast.error('Could not parse data from file');
        return;
      }

      setParsedHeaders(headers);
      setParsedRows(rows);

      // Check if we recognize this format
      const isRecognized = checkFormatMatch(headers);
      
      if (isRecognized && format?.column_mappings) {
        // Format recognized - process directly
        toast.success(`Recognized format: "${format.format_name}". Processing...`);
        await processWithMappings(rows, format.column_mappings as unknown as ColumnMappings);
      } else {
        // Format not recognized - show training dialog
        setShowTrainingDialog(true);
      }

    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveFormat = async (formatName: string, mappings: ColumnMappings) => {
    const signature = createHeaderSignature(parsedHeaders);
    await saveFormat.mutateAsync({
      format_name: formatName,
      column_mappings: mappings,
      header_signature: signature,
      sample_headers: parsedHeaders,
    });
    setShowTrainingDialog(false);
    await processWithMappings(parsedRows, mappings);
  };

  const processWithMappings = async (rows: string[][], mappings: ColumnMappings) => {
    setIsProcessing(true);
    
    try {
      // Build matters info for matching
      const mattersForMatching = matters.map(m => {
        const snapshot = m.latest_snapshot;
        return {
          id: m.id,
          matter_name: m.matter_name,
          matter_number: m.matter_number,
          client_name: m.clients?.name || '',
          currency: (m as any).effective_currency ?? m.fee_currency,
          current_wip: snapshot?.wip_amount || 0,
          current_ar: snapshot?.accounts_receivable || 0,
          current_billed: snapshot?.billed_amount || 0,
          current_paid: snapshot?.paid_amount || 0,
        };
      });

      // Convert saved mappings to format expected by edge function
      const mappingsForEdge = savedMappings.map(m => ({
        imported_matter_number: m.imported_matter_number,
        imported_matter_name: m.imported_matter_name,
        imported_client_name: m.imported_client_name,
        mapped_matter_id: m.mapped_matter_id,
      }));

      const { data, error } = await supabase.functions.invoke('parse-wip-report', {
        body: {
          rows,
          columnMappings: mappings,
          matters: mattersForMatching,
          savedMappings: mappingsForEdge,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse report');
      }

      // Convert to our format with selection state
      const matched: ImportedMatterData[] = (data.matchedData || []).map((d: any) => ({
        ...d,
        wip: { ...d.wip, selected: d.wip.changed },
        accountsReceivable: { ...d.accountsReceivable, selected: d.accountsReceivable.changed },
        totalBilled: { ...d.totalBilled, selected: d.totalBilled.changed },
        totalPaid: { ...d.totalPaid, selected: d.totalPaid.changed },
        selected: true,
      }));

      const lowConf: ImportedMatterData[] = (data.lowConfidenceData || []).map((d: any) => ({
        ...d,
        wip: { ...d.wip, selected: d.wip.changed },
        accountsReceivable: { ...d.accountsReceivable, selected: d.accountsReceivable.changed },
        totalBilled: { ...d.totalBilled, selected: d.totalBilled.changed },
        totalPaid: { ...d.totalPaid, selected: d.totalPaid.changed },
        selected: true,
      }));

      const unmatched: ImportedMatterData[] = (data.unmatchedData || []).map((d: any) => ({
        ...d,
        wip: { ...d.wip, selected: false },
        accountsReceivable: { ...d.accountsReceivable, selected: false },
        totalBilled: { ...d.totalBilled, selected: false },
        totalPaid: { ...d.totalPaid, selected: false },
        selected: false,
      }));

      setImportedData(matched);
      setLowConfidenceData(lowConf);
      setUnmatchedData(unmatched);

      // If there are low confidence matches, show confirmation step first
      if (lowConf.length > 0) {
        setStep('confirm-matches');
        toast.info(`${lowConf.length} matter(s) need your confirmation for matching`);
      } else {
        setStep('review');
        const changedCount = matched.filter(d => 
          d.wip.changed || d.accountsReceivable.changed || 
          d.totalBilled.changed || d.totalPaid.changed
        ).length;
        toast.success(
          `Found ${matched.length} matches, ${changedCount} with changes` + 
          (unmatched.length > 0 ? `, ${unmatched.length} unmatched` : '')
        );
      }

    } catch (error) {
      console.error('Processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process report');
    } finally {
      setIsProcessing(false);
    }
  };

  // Review helpers
  const changedData = useMemo(() => {
    return importedData.filter((item) => 
      item.wip.changed || item.accountsReceivable.changed || 
      item.totalBilled.changed || item.totalPaid.changed
    );
  }, [importedData]);

  const displayData = showUnchanged ? importedData : changedData;

  const filteredData = useMemo(() => {
    if (!searchTerm) return displayData;
    const lower = searchTerm.toLowerCase();
    return displayData.filter((item) =>
      item.matterNumber.toLowerCase().includes(lower) ||
      item.matterName.toLowerCase().includes(lower) ||
      item.matchedMatterName?.toLowerCase().includes(lower)
    );
  }, [displayData, searchTerm]);

  const stats = useMemo(() => {
    const matched = importedData.filter((d) => d.matchedMatterId).length;
    const changed = changedData.length;
    const unchanged = importedData.length - changed;
    const selectedFields = importedData.reduce((sum, d) => {
      if (!d.selected || !d.matchedMatterId) return sum;
      return sum + 
        (d.wip.selected && d.wip.changed ? 1 : 0) +
        (d.accountsReceivable.selected && d.accountsReceivable.changed ? 1 : 0) +
        (d.totalBilled.selected && d.totalBilled.changed ? 1 : 0) +
        (d.totalPaid.selected && d.totalPaid.changed ? 1 : 0);
    }, 0);
    return { matched, changed, unchanged, selectedFields, unmatched: unmatchedData.length };
  }, [importedData, changedData, unmatchedData]);

  const toggleMatterSelection = (rowIndex: number) => {
    setImportedData((prev) =>
      prev.map((item) =>
        item.rowIndex === rowIndex ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleFieldSelection = (rowIndex: number, field: 'wip' | 'accountsReceivable' | 'totalBilled' | 'totalPaid') => {
    setImportedData((prev) =>
      prev.map((item) =>
        item.rowIndex === rowIndex
          ? { ...item, [field]: { ...item[field], selected: !item[field].selected } }
          : item
      )
    );
  };

  const selectAll = () => {
    setImportedData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: true,
        wip: { ...item.wip, selected: item.wip.changed },
        accountsReceivable: { ...item.accountsReceivable, selected: item.accountsReceivable.changed },
        totalBilled: { ...item.totalBilled, selected: item.totalBilled.changed },
        totalPaid: { ...item.totalPaid, selected: item.totalPaid.changed },
      }))
    );
  };

  const deselectAll = () => {
    setImportedData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: false,
        wip: { ...item.wip, selected: false },
        accountsReceivable: { ...item.accountsReceivable, selected: false },
        totalBilled: { ...item.totalBilled, selected: false },
        totalPaid: { ...item.totalPaid, selected: false },
      }))
    );
  };

  const toggleRowExpanded = (rowIndex: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      const updates = importedData
        .filter((d) => d.selected && d.matchedMatterId)
        .map((d) => ({
          matter_id: d.matchedMatterId!,
          wip_amount: d.wip.selected ? d.wip.value : d.wip.current,
          wip_write_off_amount: 0, // Not tracked in new flow
          billed_amount: d.totalBilled.selected ? d.totalBilled.value : d.totalBilled.current,
          accounts_receivable: d.accountsReceivable.selected ? d.accountsReceivable.value : d.accountsReceivable.current,
          paid_amount: d.totalPaid.selected ? d.totalPaid.value : d.totalPaid.current,
        }));

      if (updates.length === 0) {
        toast.error('No changes selected');
        return;
      }

      await onApplyUpdates(updates);
      handleClose();
      toast.success(`Updated ${updates.length} matters`);
    } catch (error) {
      toast.error('Failed to apply updates');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPastedContent('');
    setUploadedFile(null);
    setImportedData([]);
    setUnmatchedData([]);
    setLowConfidenceData([]);
    setParsedHeaders([]);
    setParsedRows([]);
    setSearchTerm('');
    setShowUnchanged(false);
    setExpandedRows(new Set());
    setStep('upload');
    onClose();
  };

  // Handle confirming a low-confidence match
  const confirmMatch = async (item: ImportedMatterData, matterId: string) => {
    // Find the selected matter
    const selectedMatter = matters.find(m => m.id === matterId);
    if (!selectedMatter) return;

    // Save the mapping for future use
    try {
      await saveMapping.mutateAsync({
        imported_matter_number: item.matterNumber || null,
        imported_matter_name: item.matterName || null,
        imported_client_name: item.clientName || null,
        mapped_matter_id: matterId,
      });
    } catch (error) {
      console.error('Failed to save mapping:', error);
    }

    // Update the item with the confirmed match
    const snapshot = selectedMatter.latest_snapshot;
    const updatedItem: ImportedMatterData = {
      ...item,
      matchedMatterId: matterId,
      matchedMatterName: selectedMatter.matter_name,
      matchConfidence: 'high',
      needsConfirmation: false,
      currency: (selectedMatter as any).effective_currency ?? selectedMatter.fee_currency,
      wip: { 
        ...item.wip, 
        current: snapshot?.wip_amount || 0,
        changed: Math.abs(item.wip.value - (snapshot?.wip_amount || 0)) / Math.max(snapshot?.wip_amount || 1, 1) > 0.005,
      },
      accountsReceivable: { 
        ...item.accountsReceivable, 
        current: snapshot?.accounts_receivable || 0,
        changed: Math.abs(item.accountsReceivable.value - (snapshot?.accounts_receivable || 0)) / Math.max(snapshot?.accounts_receivable || 1, 1) > 0.005,
      },
      totalBilled: { 
        ...item.totalBilled, 
        current: snapshot?.billed_amount || 0,
        changed: Math.abs(item.totalBilled.value - (snapshot?.billed_amount || 0)) / Math.max(snapshot?.billed_amount || 1, 1) > 0.005,
      },
      totalPaid: { 
        ...item.totalPaid, 
        current: snapshot?.paid_amount || 0,
        changed: Math.abs(item.totalPaid.value - (snapshot?.paid_amount || 0)) / Math.max(snapshot?.paid_amount || 1, 1) > 0.005,
      },
    };

    // Remove from low confidence, add to imported data
    setLowConfidenceData(prev => prev.filter(d => d.rowIndex !== item.rowIndex));
    setImportedData(prev => [...prev, {
      ...updatedItem,
      wip: { ...updatedItem.wip, selected: updatedItem.wip.changed },
      accountsReceivable: { ...updatedItem.accountsReceivable, selected: updatedItem.accountsReceivable.changed },
      totalBilled: { ...updatedItem.totalBilled, selected: updatedItem.totalBilled.changed },
      totalPaid: { ...updatedItem.totalPaid, selected: updatedItem.totalPaid.changed },
      selected: true,
    }]);

    toast.success(`Confirmed match: ${selectedMatter.matter_name}`);
  };

  // Skip a low-confidence match (move to unmatched)
  const skipMatch = (item: ImportedMatterData) => {
    setLowConfidenceData(prev => prev.filter(d => d.rowIndex !== item.rowIndex));
    setUnmatchedData(prev => [...prev, { ...item, matchedMatterId: null, matchedMatterName: null }]);
  };

  // Proceed from confirm-matches step to review step
  const proceedToReview = () => {
    // Move any remaining low confidence items to imported data with their suggested match
    const remaining = lowConfidenceData.map(item => ({
      ...item,
      wip: { ...item.wip, selected: item.wip.changed },
      accountsReceivable: { ...item.accountsReceivable, selected: item.accountsReceivable.changed },
      totalBilled: { ...item.totalBilled, selected: item.totalBilled.changed },
      totalPaid: { ...item.totalPaid, selected: item.totalPaid.changed },
      selected: true,
    }));
    setImportedData(prev => [...prev, ...remaining]);
    setLowConfidenceData([]);
    setStep('review');
  };

  const renderFieldChange = (
    item: ImportedMatterData,
    field: 'wip' | 'accountsReceivable' | 'totalBilled' | 'totalPaid',
    label: string
  ) => {
    const data = item[field];
    if (!data.changed) return null;

    const isIncrease = data.value > data.current;
    const diff = data.value - data.current;

    return (
      <div className="flex items-center gap-2 py-1">
        <Checkbox
          checked={data.selected}
          onCheckedChange={() => toggleFieldSelection(item.rowIndex, field)}
          disabled={!item.selected}
        />
        <span className="text-sm w-20 text-muted-foreground">{label}:</span>
        <span className="text-sm text-muted-foreground line-through">
          {formatCurrency(data.current, item.currency)}
        </span>
        <span className="text-sm">→</span>
        <span className={cn('text-sm font-medium', data.selected ? 'text-foreground' : 'text-muted-foreground')}>
          {formatCurrency(data.value, item.currency)}
        </span>
        <Badge variant={isIncrease ? 'default' : 'secondary'} className="text-xs">
          {isIncrease ? '+' : ''}{formatCurrency(diff, item.currency)}
        </Badge>
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Master Financial Snapshot Update
            </DialogTitle>
            <DialogDescription>
              {step === 'upload' && 'Upload your financial report. The app will recognize the format or help you set it up.'}
              {step === 'review' && 'Review changes and select which updates to apply. Only changed values (beyond 0.5% tolerance) are shown.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'upload' && (
            <>
              {/* Format Status Banner */}
              {!formatLoading && (
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-sm",
                  format ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                )}>
                  {format ? (
                    <>
                      <Brain className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800 dark:text-green-200">
                          Format learned: "{format.format_name}"
                        </p>
                        <p className="text-green-700 dark:text-green-300 text-xs">
                          Upload a matching report and it will be processed automatically.
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-green-700 dark:text-green-300"
                          onClick={() => setShowFormatDetails(!showFormatDetails)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {showFormatDetails ? 'Hide' : 'View'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-green-700 dark:text-green-300"
                          onClick={() => setShowTrainingDialog(true)}
                        >
                          <Settings2 className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (confirm('Delete this report format? You will need to train the system again on your next upload.')) {
                              setIsDeletingFormat(true);
                              try {
                                await deleteFormat.mutateAsync();
                                setShowFormatDetails(false);
                              } finally {
                                setIsDeletingFormat(false);
                              }
                            }
                          }}
                          disabled={isDeletingFormat}
                        >
                          {isDeletingFormat ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          No format learned yet
                        </p>
                        <p className="text-amber-700 dark:text-amber-300 text-xs">
                          Upload a report and you'll be guided through setting up the column mappings.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Format Details Panel */}
              {showFormatDetails && format && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Column Mappings</h4>
                    <span className="text-xs text-muted-foreground">
                      Trained on {new Date(format.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {format.column_mappings.matter_number !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Matter Number:</span>
                        <span>Column {(format.column_mappings.matter_number) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.matter_name !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Matter Name:</span>
                        <span>Column {(format.column_mappings.matter_name) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.client_name !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Client Name:</span>
                        <span>Column {(format.column_mappings.client_name) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.wip !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">WIP:</span>
                        <span>Column {(format.column_mappings.wip) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.accounts_receivable !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Accounts Receivable:</span>
                        <span>Column {(format.column_mappings.accounts_receivable) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.total_billed !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Billed:</span>
                        <span>Column {(format.column_mappings.total_billed) + 1}</span>
                      </div>
                    )}
                    {format.column_mappings.total_paid !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Paid:</span>
                        <span>Column {(format.column_mappings.total_paid) + 1}</span>
                      </div>
                    )}
                  </div>
                  {format.sample_headers && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Sample headers from training:</p>
                      <div className="flex flex-wrap gap-1">
                        {(format.sample_headers as string[]).slice(0, 10).map((header, idx) => (
                          <span key={idx} className="text-xs bg-muted px-2 py-0.5 rounded">
                            {header || `(empty)`}
                          </span>
                        ))}
                        {(format.sample_headers as string[]).length > 10 && (
                          <span className="text-xs text-muted-foreground">
                            +{(format.sample_headers as string[]).length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'upload')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Excel
                  </TabsTrigger>
                  <TabsTrigger value="paste" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Paste Data
                  </TabsTrigger>
                </TabsList>

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
                      accept=".xlsx,.xls"
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
                        <p className="font-medium">Click to upload Excel file</p>
                        <p className="text-sm text-muted-foreground">
                          Supports .xlsx and .xls files
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder="Paste tab-separated data here (e.g., copied from Excel). First row should be headers."
                    className="min-h-[200px] font-mono text-sm"
                  />
                </TabsContent>
              </Tabs>

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
                    'Process Report'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'confirm-matches' && (
            <div className="flex flex-col flex-1 overflow-hidden space-y-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Link2 className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Confirm Matter Matches ({lowConfidenceData.length} remaining)
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    These matches need your confirmation. Your choices will be remembered for future imports.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <div className="divide-y">
                  {lowConfidenceData.map((item) => (
                    <div key={item.rowIndex} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="font-medium">{item.matterName || item.matterNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.matterNumber} {item.clientName && `• ${item.clientName}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            WIP: {formatCurrency(item.wip.value, item.currency)}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {item.matchConfidence} confidence
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Match to:</span>
                        <Select
                          value={item.matchedMatterId || ''}
                          onValueChange={(value) => confirmMatch(item, value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a matter..." />
                          </SelectTrigger>
                          <SelectContent>
                            {matters.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.matter_name} ({m.matter_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => skipMatch(item)}>
                          Skip
                        </Button>
                      </div>
                      
                      {item.matchedMatterName && (
                        <div className="text-sm text-primary">
                          Suggested: {item.matchedMatterName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={proceedToReview}>
                  {lowConfidenceData.length > 0 
                    ? `Continue with ${lowConfidenceData.length} suggested matches`
                    : 'Continue to Review'
                  }
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 'review' && (
            <div className="flex flex-col flex-1 overflow-hidden space-y-4">
              {/* Stats Bar */}
              <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                <div>
                  <span className="text-muted-foreground">Matched:</span>{' '}
                  <span className="font-medium">{stats.matched}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Changed:</span>{' '}
                  <span className="font-medium text-amber-600">{stats.changed}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Unchanged:</span>{' '}
                  <span className="font-medium text-muted-foreground">{stats.unchanged}</span>
                </div>
                {stats.unmatched > 0 && (
                  <div>
                    <span className="text-muted-foreground">Unmatched:</span>{' '}
                    <span className="font-medium text-destructive">{stats.unmatched}</span>
                  </div>
                )}
                <div className="ml-auto">
                  <span className="text-muted-foreground">Will import:</span>{' '}
                  <span className="font-medium text-primary">{stats.selectedFields} changes</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search matters..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showUnchanged}
                    onCheckedChange={(checked) => setShowUnchanged(!!checked)}
                  />
                  Show unchanged
                </label>
                <div className="flex gap-1 ml-auto">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                </div>
              </div>

              {/* Data List - with proper scrolling */}
              <div className="flex-1 overflow-auto border rounded-lg min-h-0">
                <div className="divide-y">
                  {filteredData.map((item) => {
                    const hasChanges = item.wip.changed || item.accountsReceivable.changed || 
                                       item.totalBilled.changed || item.totalPaid.changed;
                    const isExpanded = expandedRows.has(item.rowIndex);

                    return (
                      <div key={item.rowIndex} className={cn('p-3', !item.selected && 'opacity-60')}>
                        {/* Matter Header Row */}
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleMatterSelection(item.rowIndex)}
                          />
                          <button
                            onClick={() => toggleRowExpanded(item.rowIndex)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {item.matchedMatterName || item.matterName}
                              </span>
                              {item.matchConfidence !== 'high' && (
                                <Badge variant="outline" className="text-xs">
                                  {item.matchConfidence} match
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.matterNumber}
                            </div>
                          </div>
                          {!hasChanges && (
                            <Badge variant="secondary" className="text-xs">
                              No changes
                            </Badge>
                          )}
                        </div>

                        {/* Expanded Field Details */}
                        {isExpanded && hasChanges && (
                          <div className="ml-12 mt-2 pl-3 border-l-2 border-muted">
                            {renderFieldChange(item, 'wip', 'WIP')}
                            {renderFieldChange(item, 'accountsReceivable', 'AR')}
                            {renderFieldChange(item, 'totalBilled', 'Billed')}
                            {renderFieldChange(item, 'totalPaid', 'Paid')}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredData.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      {showUnchanged ? 'No matching items found' : 'No changes detected (all values within 0.5% tolerance)'}
                    </div>
                  )}
                </div>
              </div>

              {/* Unmatched Items Section */}
              {unmatchedData.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Unmatched Items ({unmatchedData.length})
                  </div>
                  <div className="border rounded-lg divide-y max-h-32 overflow-auto border-amber-200 dark:border-amber-800">
                    {unmatchedData.map((item) => (
                      <div key={item.rowIndex} className="p-2 flex items-center gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.matterName || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{item.matterNumber}</div>
                        </div>
                        <span className="text-muted-foreground">
                          WIP: {formatCurrency(item.wip.value, 'GBP')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back to Upload
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {stats.selectedFields} change{stats.selectedFields !== 1 ? 's' : ''} selected
                  </span>
                  <Button onClick={handleApply} disabled={isSubmitting || stats.selectedFields === 0}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      `Apply ${stats.selectedFields} Changes`
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Training Dialog */}
      <ReportFormatTrainingDialog
        isOpen={showTrainingDialog}
        onClose={() => setShowTrainingDialog(false)}
        onSave={handleSaveFormat}
        headers={parsedHeaders}
        sampleRows={parsedRows}
        existingMappings={format?.column_mappings as unknown as ColumnMappings}
        existingName={format?.format_name}
      />
    </>
  );
}
