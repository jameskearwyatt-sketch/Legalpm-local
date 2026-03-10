import { useState, useRef, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileText, AlertTriangle, Brain, Settings2, Search, ChevronDown, ChevronRight, Link2, Trash2, Eye, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currencyUtils';
import { MatterWithFinancials } from '@/lib/hooks/useMatters';
import { useReportFormats, ColumnMappings } from '@/lib/hooks/useReportFormats';
import { useReportMatterMappings } from '@/lib/hooks/useReportMatterMappings';
import { ReportFormatTrainingDialog } from './ReportFormatTrainingDialog';
import { DisbursementReviewDialog, DisbursementData, DisbursementReviewResult } from './DisbursementReviewDialog';
import { useAuth } from '@/lib/auth';
import { LocalCounsel } from '@/lib/hooks/useLocalCounsels';
import { useAggregationDecisions } from '@/lib/hooks/useAggregationDecisions';

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
  }>, lcAllocations?: DisbursementReviewResult[]) => Promise<void>;
}

interface ImportedMatterData {
  rowIndex: number;
  rowIndices?: number[]; // For aggregated multi-client rows
  matterNumber: string;
  matterName: string;
  clientName?: string;
  clientNames?: string[]; // For multi-client matters
  matchedMatterId: string | null;
  matchedMatterName: string | null;
  matchConfidence: 'high' | 'medium' | 'low' | 'none';
  needsConfirmation?: boolean;
  isMultiClientAggregate?: boolean;
  currency: string;
  wip: { value: number; current: number; changed: boolean; selected: boolean };
  wipWriteOff: { value: number; current: number; changed: boolean; selected: boolean }; // WIP write-offs
  accountsReceivable: { value: number; current: number; changed: boolean; selected: boolean };
  totalBilled: { value: number; current: number; changed: boolean; selected: boolean };
  totalPaid: { value: number; current: number; changed: boolean; selected: boolean };
  selected: boolean;
  // Manual update tracking
  wasManuallyUpdated?: boolean;
  lastManualUpdateDate?: string;
  // Disbursement data for local counsel detection
  wipDisbursement?: number;
  arDisbursement?: number;
  paidDisbursement?: number;
}

interface PotentialAggregation {
  matterName: string;
  rows: Array<{
    rowIndex: number;
    matterNumber: string;
    clientName: string;
    wip: number;
    wipWriteOff: number;
    accountsReceivable: number;
    totalBilled: number;
    totalPaid: number;
    wipDisbursement: number;
    arDisbursement: number;
    paidDisbursement: number;
    matchedMatterId: string | null;
    matchedMatterName: string | null;
    confidence: string;
  }>;
  totalWip: number;
  totalWipWriteOff: number;
  totalAr: number;
  totalBilled: number;
  totalPaid: number;
  // User decision: 'aggregate' | 'separate' | null (pending)
  decision?: 'aggregate' | 'separate' | null;
  // If aggregating, which matter to map to
  targetMatterId?: string | null;
}

type Step = 'upload' | 'training' | 'aggregate-confirm' | 'confirm-matches' | 'review' | 'disbursement-review';

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
  
  // Multi-client aggregation state
  const [potentialAggregations, setPotentialAggregations] = useState<PotentialAggregation[]>([]);
  const [autoApplyAggregation, setAutoApplyAggregation] = useState(false);
  
  // Manual data overwrite confirmation state
  const [showManualOverwriteConfirm, setShowManualOverwriteConfirm] = useState(false);
  const [mattersWithManualData, setMattersWithManualData] = useState<ImportedMatterData[]>([]);
  
  // Disbursement review state
  const [showDisbursementReview, setShowDisbursementReview] = useState(false);
  const [disbursementData, setDisbursementData] = useState<DisbursementData[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<Array<{
    matter_id: string;
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
  }>>([]);
  const [matterLocalCounsels, setMatterLocalCounsels] = useState<Record<string, LocalCounsel[]>>({});
  
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { format, isLoading: formatLoading, saveFormat, deleteFormat, checkFormatMatch, createHeaderSignature } = useReportFormats();
  const { mappings: savedMappings, saveMapping, isLoading: mappingsLoading } = useReportMatterMappings();
  const { findDecision: findSavedAggDecision, saveDecision: saveAggDecision } = useAggregationDecisions();
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
      // CRITICAL: Use actual_snapshot (not latest_snapshot) to compare against REAL system figures
      // This ensures we don't compare against WIP shaping proposal data, which is aspirational
      const mattersForMatching = matters.map(m => {
        // Use actual_snapshot for comparison - this NEVER contains proposal data
        const snapshot = (m as any).actual_snapshot || m.latest_snapshot;
        // Check if the latest snapshot was manually updated
        const snapshotAny = snapshot as Record<string, unknown> | null;
        const wasManual = snapshotAny?.update_source === 'manual';
        // Get LC data for disbursement comparison
        const lcWip = (m as any).lc_wip || 0;
        const lcBilled = (m as any).lc_billed || 0;
        return {
          id: m.id,
          matter_name: m.matter_name,
          matter_number: m.matter_number,
          client_name: m.clients?.name || '',
          cm_number: m.cm_number || '',
          currency: (m as any).effective_currency ?? m.fee_currency,
          current_wip: snapshot?.wip_amount || 0,
          current_wip_write_off: snapshot?.wip_write_off_amount || 0,
          current_ar: snapshot?.accounts_receivable || 0,
          current_billed: snapshot?.billed_amount || 0,
          current_paid: snapshot?.paid_amount || 0,
          is_multi_client: m.is_multi_client || false,
          // Track if latest snapshot was manually updated
          was_manually_updated: wasManual,
          last_manual_update_date: wasManual ? snapshot?.as_of_date : null,
          // LC data for disbursement comparison - to avoid flagging already-logged LC fees
          lc_wip: lcWip,
          lc_billed: lcBilled,
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
      // Also look up manual update info from mattersForMatching
      const getMatterInfo = (matterId: string | null) => {
        if (!matterId) return { wasManuallyUpdated: false, lastManualUpdateDate: null };
        const mInfo = mattersForMatching.find(m => m.id === matterId);
        return {
          wasManuallyUpdated: mInfo?.was_manually_updated || false,
          lastManualUpdateDate: mInfo?.last_manual_update_date || null,
        };
      };

      const matched: ImportedMatterData[] = (data.matchedData || []).map((d: any) => {
        const manualInfo = getMatterInfo(d.matchedMatterId);
        return {
          ...d,
          wip: { ...d.wip, selected: d.wip.changed },
          wipWriteOff: d.wipWriteOff 
            ? { ...d.wipWriteOff, selected: d.wipWriteOff.changed }
            : { value: 0, current: 0, changed: false, selected: false },
          accountsReceivable: { ...d.accountsReceivable, selected: d.accountsReceivable.changed },
          totalBilled: { ...d.totalBilled, selected: d.totalBilled.changed },
          totalPaid: { ...d.totalPaid, selected: d.totalPaid.changed },
          selected: true,
          wasManuallyUpdated: manualInfo.wasManuallyUpdated,
          lastManualUpdateDate: manualInfo.lastManualUpdateDate,
        };
      });

      const lowConf: ImportedMatterData[] = (data.lowConfidenceData || []).map((d: any) => {
        const manualInfo = getMatterInfo(d.matchedMatterId);
        return {
          ...d,
          wip: { ...d.wip, selected: d.wip.changed },
          wipWriteOff: d.wipWriteOff 
            ? { ...d.wipWriteOff, selected: d.wipWriteOff.changed }
            : { value: 0, current: 0, changed: false, selected: false },
          accountsReceivable: { ...d.accountsReceivable, selected: d.accountsReceivable.changed },
          totalBilled: { ...d.totalBilled, selected: d.totalBilled.changed },
          totalPaid: { ...d.totalPaid, selected: d.totalPaid.changed },
          selected: true,
          wasManuallyUpdated: manualInfo.wasManuallyUpdated,
          lastManualUpdateDate: manualInfo.lastManualUpdateDate,
        };
      });

      const unmatched: ImportedMatterData[] = (data.unmatchedData || []).map((d: any) => ({
        ...d,
        wip: { ...d.wip, selected: false },
        wipWriteOff: d.wipWriteOff 
          ? { ...d.wipWriteOff, selected: false }
          : { value: 0, current: 0, changed: false, selected: false },
        accountsReceivable: { ...d.accountsReceivable, selected: false },
        totalBilled: { ...d.totalBilled, selected: false },
        totalPaid: { ...d.totalPaid, selected: false },
        selected: false,
      }));

      setImportedData(matched);
      setLowConfidenceData(lowConf);
      setUnmatchedData(unmatched);

      // Store potential aggregations from edge function, auto-applying saved decisions
      const aggCandidates: PotentialAggregation[] = (data.potentialAggregations || []).map((a: any) => {
        const saved = findSavedAggDecision(a.matterName);
        if (saved) {
          // Check target matter still exists if it was an aggregate decision
          const targetStillExists = saved.decision === 'aggregate' 
            ? matters.some(m => m.id === saved.target_matter_id)
            : true;
          return {
            ...a,
            decision: targetStillExists ? saved.decision : null,
            targetMatterId: targetStillExists ? saved.target_matter_id : null,
          };
        }
        return {
          ...a,
          decision: null,
          targetMatterId: null,
        };
      });
      setPotentialAggregations(aggCandidates);

      // Check if ALL aggregation candidates have saved decisions (auto-skip the step)
      const allDecided = aggCandidates.length > 0 && aggCandidates.every(
        a => a.decision !== null && a.decision !== undefined && 
             (a.decision !== 'aggregate' || a.targetMatterId)
      );

      // If there are potential aggregations, show that step (or auto-proceed if all remembered)
      if (aggCandidates.length > 0) {
        if (allDecided) {
          // Auto-apply without showing the step - set flag for effect
          toast.success(`${aggCandidates.length} multi-client group(s) auto-applied from previous decisions`);
          setAutoApplyAggregation(true);
          setStep('aggregate-confirm');
        } else {
          setStep('aggregate-confirm');
          toast.info(`${aggCandidates.length} potential multi-client group(s) detected — please review`);
        }
      } else if (lowConf.length > 0) {
        // If there are low confidence matches, show confirmation step
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
  const DISBURSEMENT_THRESHOLD = 1000; // Flag disbursements above this amount
  const LC_MATERIALITY_THRESHOLD = 0.02; // 2% - if disbursement is within 2% of existing LC amount, it's immaterial
  const IMMATERIAL_CHANGE_THRESHOLD = 0.02; // 2% - changes below this are considered immaterial

  // Helper to check if a value change is immaterial (within 2%)
  const isImmaterialChange = (newValue: number, currentValue: number): boolean => {
    if (currentValue === 0 && newValue === 0) return true;
    if (currentValue === 0) return newValue < 100; // Small absolute change from zero
    const percentChange = Math.abs(newValue - currentValue) / Math.abs(currentValue);
    return percentChange <= IMMATERIAL_CHANGE_THRESHOLD;
  };

  // Helper to check if a disbursement amount is already tracked as LC fee
  // Returns true if the amount is materially different from existing LC amounts
  // Returns false if the disbursement matches existing LC data (within materiality threshold)
  const isDisbursementNotAlreadyTracked = (
    matterId: string | null,
    wipDisb: number,
    billedDisb: number // AR + Paid disbursements combined
  ): boolean => {
    if (!matterId) return true;
    const matter = matters.find(m => m.id === matterId);
    if (!matter) return true;
    
    const lcWip = (matter as any).lc_wip || 0;
    const lcBilled = (matter as any).lc_billed || 0;
    const totalLcTracked = lcWip + lcBilled; // Total LC amount already tracked in the matter
    
    // If there's no existing LC data at all, any significant disbursement is potentially untracked
    const hasExistingLcData = totalLcTracked > 0;
    
    // Total disbursement from Excel
    const totalDisbFromExcel = wipDisb + billedDisb;
    
    // If disbursement is below threshold, don't flag it
    if (totalDisbFromExcel < DISBURSEMENT_THRESHOLD) {
      return false;
    }
    
    // If no existing LC data, this is a new potential LC fee
    if (!hasExistingLcData) {
      return true;
    }
    
    // Compare TOTAL disbursement against TOTAL tracked LC amount
    // This handles cases where LC has moved from WIP to Billed (normal billing cycle)
    // e.g., Excel shows $33k billed disbursement, matter has $33k lc_billed = already tracked
    const percentDifference = Math.abs(totalDisbFromExcel - totalLcTracked) / Math.max(totalDisbFromExcel, totalLcTracked);
    
    // If the disbursement is within materiality threshold of tracked LC, it's already accounted for
    if (percentDifference <= LC_MATERIALITY_THRESHOLD) {
      return false; // NOT untracked - it matches existing LC data
    }
    
    // Disbursement is materially different from tracked LC - flag it
    return true;
  };

  // Helper to check if disbursement is tracked but has a minor (immaterial) difference
  const hasImmaterialDisbursementDifference = (
    matterId: string | null,
    wipDisb: number,
    billedDisb: number
  ): boolean => {
    if (!matterId) return false;
    const matter = matters.find(m => m.id === matterId);
    if (!matter) return false;
    
    const lcWip = (matter as any).lc_wip || 0;
    const lcBilled = (matter as any).lc_billed || 0;
    const totalLcTracked = lcWip + lcBilled;
    const totalDisbFromExcel = wipDisb + billedDisb;
    
    // Must have both existing LC data AND disbursement data
    if (totalLcTracked === 0 || totalDisbFromExcel < DISBURSEMENT_THRESHOLD) {
      return false;
    }
    
    const percentDifference = Math.abs(totalDisbFromExcel - totalLcTracked) / Math.max(totalDisbFromExcel, totalLcTracked);
    
    // If there's a small but non-zero difference (within threshold), it's immaterial
    return percentDifference > 0 && percentDifference <= LC_MATERIALITY_THRESHOLD;
  };

  // Categorize each matter's changes as material or immaterial
  const categorizedData = useMemo(() => {
    return importedData.map(item => {
      // Check each financial field for immateriality
      const wipImmaterial = item.wip.changed && isImmaterialChange(item.wip.value, item.wip.current);
      const wipWriteOffImmaterial = item.wipWriteOff?.changed && isImmaterialChange(item.wipWriteOff.value, item.wipWriteOff.current);
      const arImmaterial = item.accountsReceivable.changed && isImmaterialChange(item.accountsReceivable.value, item.accountsReceivable.current);
      const billedImmaterial = item.totalBilled.changed && isImmaterialChange(item.totalBilled.value, item.totalBilled.current);
      const paidImmaterial = item.totalPaid.changed && isImmaterialChange(item.totalPaid.value, item.totalPaid.current);
      
      // An item is "all immaterial" if all its changes are immaterial
      const hasAnyMaterialChange = 
        (item.wip.changed && !wipImmaterial) ||
        (item.wipWriteOff?.changed && !wipWriteOffImmaterial) ||
        (item.accountsReceivable.changed && !arImmaterial) ||
        (item.totalBilled.changed && !billedImmaterial) ||
        (item.totalPaid.changed && !paidImmaterial);
      
      // Check for untracked disbursements (these are always material if present)
      const wipDisb = item.wipDisbursement || 0;
      const billedDisb = (item.arDisbursement || 0) + (item.paidDisbursement || 0);
      const hasUntrackedDisbursement = isDisbursementNotAlreadyTracked(item.matchedMatterId, wipDisb, billedDisb);
      
      // Check if there's a minor disbursement difference (for display purposes in immaterial section)
      const hasMinorLcDifference = hasImmaterialDisbursementDifference(item.matchedMatterId, wipDisb, billedDisb);
      
      const isImmaterial = !hasAnyMaterialChange && !hasUntrackedDisbursement;
      
      return {
        ...item,
        isImmaterial,
        wipImmaterial,
        wipWriteOffImmaterial,
        arImmaterial,
        billedImmaterial,
        paidImmaterial,
        hasUntrackedDisbursement,
        hasMinorLcDifference, // Show in immaterial section that LC fee has tiny discrepancy
      };
    });
  }, [importedData, matters]);

  const changedData = useMemo(() => {
    return categorizedData.filter((item) => {
      const hasFinancialChanges = item.wip.changed || item.wipWriteOff?.changed || 
                                   item.accountsReceivable.changed || 
                                   item.totalBilled.changed || item.totalPaid.changed;
      return hasFinancialChanges || item.hasUntrackedDisbursement;
    });
  }, [categorizedData]);

  // Split into material and immaterial for display
  const materialData = useMemo(() => changedData.filter(d => !d.isImmaterial), [changedData]);
  const immaterialData = useMemo(() => changedData.filter(d => d.isImmaterial), [changedData]);

  const displayData = showUnchanged ? categorizedData : changedData;

  const filteredData = useMemo(() => {
    const applyFilter = (data: typeof displayData) => {
      if (!searchTerm) return data;
      const lower = searchTerm.toLowerCase();
      return data.filter((item) =>
        item.matterNumber.toLowerCase().includes(lower) ||
        item.matterName.toLowerCase().includes(lower) ||
        item.matchedMatterName?.toLowerCase().includes(lower)
      );
    };
    return applyFilter(displayData);
  }, [displayData, searchTerm]);

  // Split filtered data into material and immaterial for separate display
  const filteredMaterialData = useMemo(() => 
    filteredData.filter(d => !d.isImmaterial), [filteredData]);
  const filteredImmaterialData = useMemo(() => 
    filteredData.filter(d => d.isImmaterial), [filteredData]);

  const stats = useMemo(() => {
    const matched = categorizedData.filter((d) => d.matchedMatterId).length;
    const changed = changedData.length;
    const unchanged = categorizedData.length - changed;
    
    // Count financial field changes
    const selectedFinancialFields = categorizedData.reduce((sum, d) => {
      if (!d.selected || !d.matchedMatterId) return sum;
      return sum + 
        (d.wip.selected && d.wip.changed ? 1 : 0) +
        (d.wipWriteOff?.selected && d.wipWriteOff?.changed ? 1 : 0) +
        (d.accountsReceivable.selected && d.accountsReceivable.changed ? 1 : 0) +
        (d.totalBilled.selected && d.totalBilled.changed ? 1 : 0) +
        (d.totalPaid.selected && d.totalPaid.changed ? 1 : 0);
    }, 0);
    
    // Count matters with unaccounted disbursements (not already tracked as LC fees)
    const withSignificantDisbursements = categorizedData.filter(d => 
      d.selected && d.hasUntrackedDisbursement
    ).length;
    
    // Total changes = financial fields + disbursements to review
    const totalChanges = selectedFinancialFields + withSignificantDisbursements;
    
    const manuallyUpdated = categorizedData.filter(d => d.wasManuallyUpdated && d.selected).length;
    
    // Count material vs immaterial
    const materialCount = materialData.filter(d => d.selected).length;
    const immaterialCount = immaterialData.filter(d => d.selected).length;
    
    return { 
      matched, 
      changed, 
      unchanged, 
      selectedFields: selectedFinancialFields, 
      totalChanges,
      unmatched: unmatchedData.length, 
      manuallyUpdated, 
      withSignificantDisbursements,
      materialCount,
      immaterialCount,
    };
  }, [categorizedData, changedData, unmatchedData, materialData, immaterialData]);

  const toggleMatterSelection = (rowIndex: number) => {
    setImportedData((prev) =>
      prev.map((item) => {
        if (item.rowIndex !== rowIndex) return item;
        const newSelected = !item.selected;
        // When selecting a matter, also enable its changed fields
        // When deselecting, keep field selections as-is (user might want to re-select with same fields)
        if (newSelected) {
          return {
            ...item,
            selected: true,
            wip: { ...item.wip, selected: item.wip.changed },
            wipWriteOff: item.wipWriteOff ? { ...item.wipWriteOff, selected: item.wipWriteOff.changed } : item.wipWriteOff,
            accountsReceivable: { ...item.accountsReceivable, selected: item.accountsReceivable.changed },
            totalBilled: { ...item.totalBilled, selected: item.totalBilled.changed },
            totalPaid: { ...item.totalPaid, selected: item.totalPaid.changed },
          };
        }
        return { ...item, selected: false };
      })
    );
  };

  const toggleFieldSelection = (rowIndex: number, field: 'wip' | 'wipWriteOff' | 'accountsReceivable' | 'totalBilled' | 'totalPaid') => {
    setImportedData((prev) =>
      prev.map((item) => {
        if (item.rowIndex !== rowIndex) return item;
        const fieldData = item[field];
        if (!fieldData) return item;
        return { ...item, [field]: { ...fieldData, selected: !fieldData.selected } };
      })
    );
  };

  const selectAll = () => {
    setImportedData((prev) =>
      prev.map((item) => ({
        ...item,
        selected: true,
        wip: { ...item.wip, selected: item.wip.changed },
        wipWriteOff: item.wipWriteOff ? { ...item.wipWriteOff, selected: item.wipWriteOff.changed } : item.wipWriteOff,
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
        wipWriteOff: item.wipWriteOff ? { ...item.wipWriteOff, selected: false } : item.wipWriteOff,
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

  // Fetch local counsels for matters with significant disbursements
  const fetchLocalCounselsForMatters = async (matterIds: string[]) => {
    if (matterIds.length === 0) return {};
    
    const { data, error } = await supabase
      .from('matter_local_counsels')
      .select('*')
      .in('matter_id', matterIds);
    
    if (error) {
      console.error('Failed to fetch local counsels:', error);
      return {};
    }
    
    // Group by matter_id
    const grouped: Record<string, LocalCounsel[]> = {};
    for (const lc of data || []) {
      if (!grouped[lc.matter_id]) {
        grouped[lc.matter_id] = [];
      }
      grouped[lc.matter_id].push(lc as LocalCounsel);
    }
    return grouped;
  };

  // The actual apply logic - called after all confirmations
  const executeApply = async (updates: Array<{
    matter_id: string;
    wip_amount: number;
    wip_write_off_amount: number;
    billed_amount: number;
    accounts_receivable: number;
    paid_amount: number;
  }>) => {
    setIsSubmitting(true);
    try {
      // Check for significant disbursements that are NOT already tracked as LC fees
      const mattersWithDisbursements = importedData.filter(d => {
        if (!d.selected || !d.matchedMatterId) return false;
        const wipDisb = d.wipDisbursement || 0;
        const billedDisb = (d.arDisbursement || 0) + (d.paidDisbursement || 0);
        return isDisbursementNotAlreadyTracked(d.matchedMatterId, wipDisb, billedDisb);
      });

      if (mattersWithDisbursements.length > 0) {
        // Fetch local counsels for these matters
        const matterIds = mattersWithDisbursements.map(d => d.matchedMatterId!);
        const lcData = await fetchLocalCounselsForMatters(matterIds);
        setMatterLocalCounsels(lcData);

        // Build disbursement data for review dialog
        const disbursements: DisbursementData[] = mattersWithDisbursements.map(d => ({
          matterId: d.matchedMatterId!,
          matterName: d.matchedMatterName || d.matterName,
          matterNumber: d.matterNumber,
          currency: d.currency,
          wipDisbursement: d.wipDisbursement || 0,
          arDisbursement: d.arDisbursement || 0,
          paidDisbursement: d.paidDisbursement || 0,
          localCounsels: lcData[d.matchedMatterId!] || [],
        }));

        setDisbursementData(disbursements);
        setPendingUpdates(updates);
        setShowDisbursementReview(true);
        setIsSubmitting(false);
        return;
      }

      // No disbursements to review - apply updates directly
      await onApplyUpdates(updates);
      handleClose();
      toast.success(`Updated ${updates.length} matters`);
    } catch (error) {
      toast.error('Failed to apply updates');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async () => {
    const updates = importedData
      .filter((d) => d.selected && d.matchedMatterId)
      .map((d) => {
        // Financial snapshots are stored in billing currency - no conversion needed
        // Get raw values (in billing currency from the report)
        const rawWip = d.wip.selected ? d.wip.value : d.wip.current;
        const rawBilled = d.totalBilled.selected ? d.totalBilled.value : d.totalBilled.current;
        const rawAr = d.accountsReceivable.selected ? d.accountsReceivable.value : d.accountsReceivable.current;
        const rawPaid = d.totalPaid.selected ? d.totalPaid.value : d.totalPaid.current;
        
        return {
          matter_id: d.matchedMatterId!,
          wip_amount: rawWip,
          wip_write_off_amount: d.wipWriteOff?.selected ? d.wipWriteOff.value : d.wipWriteOff?.current || 0,
          billed_amount: rawBilled,
          accounts_receivable: rawAr,
          paid_amount: rawPaid,
        };
      });

    if (updates.length === 0) {
      toast.error('No changes selected');
      return;
    }

    // Check for matters with manually-entered data that would be overwritten
    const manualMatters = importedData.filter(d => 
      d.selected && d.matchedMatterId && d.wasManuallyUpdated && (
        d.wip.selected || d.accountsReceivable.selected || 
        d.totalBilled.selected || d.totalPaid.selected
      )
    );

    if (manualMatters.length > 0) {
      // Show confirmation dialog
      setMattersWithManualData(manualMatters);
      setPendingUpdates(updates);
      setShowManualOverwriteConfirm(true);
      return;
    }

    // No manual data to confirm - proceed with apply
    await executeApply(updates);
  };

  // Handle confirmation to proceed despite manual data
  const handleConfirmManualOverwrite = async () => {
    setShowManualOverwriteConfirm(false);
    setMattersWithManualData([]);
    await executeApply(pendingUpdates);
  };

  // Handle cancellation of manual overwrite
  const handleCancelManualOverwrite = () => {
    setShowManualOverwriteConfirm(false);
    setMattersWithManualData([]);
    setPendingUpdates([]);
  };

  // Handle completion of disbursement review
  const handleDisbursementReviewComplete = async (results: DisbursementReviewResult[]) => {
    setShowDisbursementReview(false);
    setIsSubmitting(true);
    
    try {
      // Apply the financial updates with LC allocation data
      await onApplyUpdates(pendingUpdates, results);
      handleClose();
      toast.success(`Updated ${pendingUpdates.length} matters`);
    } catch (error) {
      toast.error('Failed to apply updates');
    } finally {
      setIsSubmitting(false);
      setPendingUpdates([]);
      setDisbursementData([]);
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
    setShowDisbursementReview(false);
    setDisbursementData([]);
    setPendingUpdates([]);
    setMatterLocalCounsels({});
    setShowManualOverwriteConfirm(false);
    setMattersWithManualData([]);
    setPotentialAggregations([]);
    onClose();
  };

  // Auto-proceed from aggregation step when all decisions are pre-filled from saved data
  useEffect(() => {
    if (autoApplyAggregation && step === 'aggregate-confirm' && potentialAggregations.length > 0) {
      setAutoApplyAggregation(false);
      proceedFromAggregation();
    }
  }, [autoApplyAggregation, step, potentialAggregations]);

  // Handle aggregation decisions
  const setAggregationDecision = (index: number, decision: 'aggregate' | 'separate') => {
    setPotentialAggregations(prev => prev.map((agg, i) => 
      i === index ? { ...agg, decision } : agg
    ));
  };

  const setAggregationTarget = (index: number, matterId: string) => {
    setPotentialAggregations(prev => prev.map((agg, i) => 
      i === index ? { ...agg, targetMatterId: matterId } : agg
    ));
  };

  const proceedFromAggregation = () => {
    // Apply aggregation decisions to importedData
    for (const agg of potentialAggregations) {
      if (agg.decision === 'aggregate' && agg.targetMatterId) {
        // Find the target matter
        const targetMatter = matters.find(m => m.id === agg.targetMatterId);
        if (!targetMatter) continue;

        const snapshot = targetMatter.latest_snapshot;
        const rowIndices = agg.rows.map(r => r.rowIndex);
        const clientNames = agg.rows.map(r => r.clientName).filter(Boolean);

        // Remove individual rows from importedData, lowConfidenceData, unmatchedData
        setImportedData(prev => prev.filter(d => !rowIndices.includes(d.rowIndex)));
        setLowConfidenceData(prev => prev.filter(d => !rowIndices.includes(d.rowIndex)));
        setUnmatchedData(prev => prev.filter(d => !rowIndices.includes(d.rowIndex)));

        // Create aggregated row
        const aggregatedItem: ImportedMatterData = {
          rowIndex: agg.rows[0].rowIndex,
          rowIndices,
          matterNumber: agg.rows[0].matterNumber,
          matterName: agg.matterName,
          clientName: clientNames.join(', '),
          clientNames: clientNames.length > 1 ? clientNames : undefined,
          matchedMatterId: agg.targetMatterId,
          matchedMatterName: targetMatter.matter_name,
          matchConfidence: 'high',
          needsConfirmation: false,
          isMultiClientAggregate: true,
          currency: (targetMatter as any).effective_currency ?? targetMatter.fee_currency,
          wip: {
            value: agg.totalWip,
            current: snapshot?.wip_amount || 0,
            changed: Math.abs(agg.totalWip - (snapshot?.wip_amount || 0)) > 0.001,
            selected: Math.abs(agg.totalWip - (snapshot?.wip_amount || 0)) > 0.001,
          },
          wipWriteOff: {
            value: agg.totalWipWriteOff,
            current: snapshot?.wip_write_off_amount || 0,
            changed: Math.abs(agg.totalWipWriteOff - (snapshot?.wip_write_off_amount || 0)) > 0.001,
            selected: Math.abs(agg.totalWipWriteOff - (snapshot?.wip_write_off_amount || 0)) > 0.001,
          },
          accountsReceivable: {
            value: agg.totalAr,
            current: snapshot?.accounts_receivable || 0,
            changed: Math.abs(agg.totalAr - (snapshot?.accounts_receivable || 0)) > 0.001,
            selected: Math.abs(agg.totalAr - (snapshot?.accounts_receivable || 0)) > 0.001,
          },
          totalBilled: {
            value: agg.totalBilled,
            current: snapshot?.billed_amount || 0,
            changed: Math.abs(agg.totalBilled - (snapshot?.billed_amount || 0)) > 0.001,
            selected: Math.abs(agg.totalBilled - (snapshot?.billed_amount || 0)) > 0.001,
          },
          totalPaid: {
            value: agg.totalPaid,
            current: snapshot?.paid_amount || 0,
            changed: Math.abs(agg.totalPaid - (snapshot?.paid_amount || 0)) > 0.001,
            selected: Math.abs(agg.totalPaid - (snapshot?.paid_amount || 0)) > 0.001,
          },
          selected: true,
          wipDisbursement: agg.rows.reduce((s, r) => s + r.wipDisbursement, 0),
          arDisbursement: agg.rows.reduce((s, r) => s + r.arDisbursement, 0),
          paidDisbursement: agg.rows.reduce((s, r) => s + r.paidDisbursement, 0),
        };

        // Add to importedData
        setImportedData(prev => [...prev, aggregatedItem]);
      }
      // If 'separate', the rows stay as-is (already in their respective lists)
    }

    // Move to next step
    if (lowConfidenceData.length > 0) {
      setStep('confirm-matches');
      toast.info(`${lowConfidenceData.length} matter(s) need your confirmation for matching`);
    } else {
      setStep('review');
    }
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
    const currentWipWriteOff = snapshot?.wip_write_off_amount || 0;
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
      wipWriteOff: {
        value: item.wipWriteOff?.value || 0,
        current: currentWipWriteOff,
        changed: Math.abs((item.wipWriteOff?.value || 0) - currentWipWriteOff) / Math.max(currentWipWriteOff || 1, 1) > 0.005,
        selected: false, // Will be set below
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
      wipWriteOff: { ...updatedItem.wipWriteOff, selected: updatedItem.wipWriteOff.changed },
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
  const proceedToReview = async () => {
    // Save mappings for all remaining low-confidence items that have a matched matter
    // This ensures we remember these matches for future imports
    for (const item of lowConfidenceData) {
      if (item.matchedMatterId) {
        try {
          await saveMapping.mutateAsync({
            imported_matter_number: item.matterNumber || null,
            imported_matter_name: item.matterName || null,
            imported_client_name: item.clientName || null,
            mapped_matter_id: item.matchedMatterId,
          });
        } catch (error) {
          console.error('Failed to save mapping for:', item.matterName, error);
        }
      }
    }

    // Move any remaining low confidence items to imported data with their suggested match
    const remaining = lowConfidenceData.map(item => ({
      ...item,
      wip: { ...item.wip, selected: item.wip.changed },
      wipWriteOff: item.wipWriteOff 
        ? { ...item.wipWriteOff, selected: item.wipWriteOff.changed }
        : { value: 0, current: 0, changed: false, selected: false },
      accountsReceivable: { ...item.accountsReceivable, selected: item.accountsReceivable.changed },
      totalBilled: { ...item.totalBilled, selected: item.totalBilled.changed },
      totalPaid: { ...item.totalPaid, selected: item.totalPaid.changed },
      selected: true,
    }));
    setImportedData(prev => [...prev, ...remaining]);
    setLowConfidenceData([]);
    setStep('review');
    toast.success('Mappings saved for future imports');
  };

  const renderFieldChange = (
    item: ImportedMatterData,
    field: 'wip' | 'wipWriteOff' | 'accountsReceivable' | 'totalBilled' | 'totalPaid',
    label: string
  ) => {
    const data = item[field];
    if (!data || !data.changed) return null;

    const isIncrease = data.value > data.current;
    const diff = data.value - data.current;

    return (
      <div className="flex items-center gap-2 py-1">
        <Checkbox
          checked={data.selected}
          onCheckedChange={() => toggleFieldSelection(item.rowIndex, field)}
          disabled={!item.selected}
        />
        <span className="text-sm w-24 text-muted-foreground">{label}:</span>
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
                    {format.column_mappings.wip_write_off !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">WIP Write-off:</span>
                        <span>Column {(format.column_mappings.wip_write_off) + 1}</span>
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

          {step === 'aggregate-confirm' && (
            <div className="flex flex-col flex-1 overflow-hidden space-y-4">
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Potential Multi-Client Matters Detected ({potentialAggregations.length})
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    These rows share the same matter name but have different matter numbers or client names. Should they be aggregated into a single matter, or kept as separate entries?
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-auto border rounded-lg">
                <div className="divide-y">
                  {potentialAggregations.map((agg, aggIndex) => (
                    <div key={aggIndex} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium">{agg.matterName}</span>
                          <div className="text-sm text-muted-foreground mt-1">
                            {agg.rows.length} rows • Total WIP: {formatCurrency(agg.totalWip, 'GBP')}
                            {agg.totalWipWriteOff > 0 && ` • Write-offs: ${formatCurrency(agg.totalWipWriteOff, 'GBP')}`}
                            {agg.totalBilled > 0 && ` • Billed: ${formatCurrency(agg.totalBilled, 'GBP')}`}
                          </div>
                        </div>
                        <Badge 
                          variant={agg.decision === 'aggregate' ? 'default' : agg.decision === 'separate' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {agg.decision === 'aggregate' ? 'Will aggregate' : agg.decision === 'separate' ? 'Keep separate' : 'Pending'}
                        </Badge>
                      </div>

                      {/* Show individual rows */}
                      <div className="ml-4 space-y-1 border-l-2 border-muted pl-3">
                        {agg.rows.map((row, rowIdx) => (
                          <div key={rowIdx} className="text-sm flex items-center gap-3">
                            <span className="text-muted-foreground w-28 truncate" title={row.matterNumber}>
                              {row.matterNumber || '(no number)'}
                            </span>
                            <span className="text-muted-foreground w-36 truncate" title={row.clientName}>
                              {row.clientName || '(no client)'}
                            </span>
                            <span className="font-mono">{formatCurrency(row.wip, 'GBP')}</span>
                            {row.matchedMatterName && (
                              <Badge variant="outline" className="text-xs">
                                → {row.matchedMatterName}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Decision buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant={agg.decision === 'aggregate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setAggregationDecision(aggIndex, 'aggregate')}
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          Aggregate into one matter
                        </Button>
                        <Button
                          variant={agg.decision === 'separate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setAggregationDecision(aggIndex, 'separate')}
                        >
                          Keep separate
                        </Button>
                        
                        {agg.decision === 'aggregate' && (
                          <Select
                            value={agg.targetMatterId || ''}
                            onValueChange={(value) => setAggregationTarget(aggIndex, value)}
                          >
                            <SelectTrigger className="flex-1 max-w-xs">
                              <SelectValue placeholder="Select target matter..." />
                            </SelectTrigger>
                            <SelectContent>
                              {matters.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.matter_name} ({m.matter_number})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button 
                  onClick={proceedFromAggregation}
                  disabled={potentialAggregations.some(a => a.decision === null || a.decision === undefined || (a.decision === 'aggregate' && !a.targetMatterId))}
                >
                  Continue
                </Button>
              </DialogFooter>
            </div>
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.matterName || item.matterNumber}</span>
                            {item.isMultiClientAggregate && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <Users className="h-3 w-3" />
                                {item.rowIndices?.length || 1} clients
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.matterNumber} {item.clientName && `• ${item.clientName}`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            WIP: {formatCurrency(item.wip.value, item.currency)}
                            {item.isMultiClientAggregate && ' (aggregated)'}
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
                                {m.is_multi_client && ' [Multi-client]'}
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
                {stats.manuallyUpdated > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-600 font-medium">{stats.manuallyUpdated} with manual data</span>
                  </div>
                )}
                {stats.withSignificantDisbursements > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    <span className="text-rose-600 font-medium">{stats.withSignificantDisbursements} with large disbursements</span>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-muted-foreground">Will import:</span>{' '}
                  <span className="font-medium text-primary">{stats.totalChanges} changes</span>
                  {stats.immaterialCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({stats.immaterialCount} immaterial)
                    </span>
                  )}
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
                  {/* Material Changes Section Header */}
                  {filteredMaterialData.length > 0 && (
                    <div className="p-3 bg-background border-b-2 border-primary/20 sticky top-0 z-10 before:absolute before:inset-0 before:bg-primary/5 before:-z-10 relative">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span>Material Changes ({filteredMaterialData.length})</span>
                        <span className="text-xs font-normal text-muted-foreground">— significant updates requiring review</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Material Changes Items */}
                  {filteredMaterialData.map((item) => {
                    const hasFinancialChanges = item.wip.changed || item.wipWriteOff?.changed ||
                                       item.accountsReceivable.changed || 
                                       item.totalBilled.changed || item.totalPaid.changed;
                    const hasSignificantDisbursements = item.hasUntrackedDisbursement;
                    const isExpanded = expandedRows.has(item.rowIndex);

                    return (
                      <div 
                        key={item.rowIndex} 
                        className={cn(
                          'p-3',
                          !item.selected && 'opacity-60',
                          // Highlight matters with manual updates
                          item.wasManuallyUpdated && item.selected && 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500',
                          // Highlight matters with significant disbursements
                          !item.wasManuallyUpdated && hasSignificantDisbursements && item.selected && 'bg-rose-50/80 dark:bg-rose-950/30 border-l-4 border-l-rose-500'
                        )}
                      >
                        {/* Manual Update Warning */}
                        {item.wasManuallyUpdated && item.selected && (
                          <div className="mb-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>
                              Latest data was manually entered
                              {item.lastManualUpdateDate && (
                                <span className="font-normal text-amber-600 dark:text-amber-500">
                                  {' '}on {new Date(item.lastManualUpdateDate).toLocaleDateString()}
                                </span>
                              )}
                              — updating will overwrite your manual input
                            </span>
                          </div>
                        )}

                        {/* Disbursement Warning */}
                        {hasSignificantDisbursements && item.selected && (
                          <div className="mb-2 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>
                              Large disbursements detected — may be local counsel fees
                              <span className="font-normal text-rose-600 dark:text-rose-500 ml-1">
                                (WIP: {formatCurrency(item.wipDisbursement || 0, item.currency)}, 
                                AR: {formatCurrency(item.arDisbursement || 0, item.currency)}, 
                                Paid: {formatCurrency(item.paidDisbursement || 0, item.currency)})
                              </span>
                            </span>
                          </div>
                        )}
                        
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
                              <span className={cn(
                                "font-medium truncate",
                                item.wasManuallyUpdated && item.selected && "text-amber-800 dark:text-amber-300",
                                !item.wasManuallyUpdated && hasSignificantDisbursements && item.selected && "text-rose-800 dark:text-rose-300"
                              )}>
                                {item.matchedMatterName || item.matterName}
                              </span>
                              {item.wasManuallyUpdated && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                  Manual Data
                                </Badge>
                              )}
                              {hasSignificantDisbursements && (
                                <Badge className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-rose-300 dark:border-rose-700">
                                  Large Disbursements
                                </Badge>
                              )}
                              {item.isMultiClientAggregate && (
                                <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                  <Users className="h-3 w-3" />
                                  {item.rowIndices?.length || 1} clients aggregated
                                </Badge>
                              )}
                              {item.matchConfidence !== 'high' && !item.isMultiClientAggregate && (
                                <Badge variant="outline" className="text-xs">
                                  {item.matchConfidence} match
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.matterNumber}
                              {item.clientNames && item.clientNames.length > 1 && (
                                <span className="ml-1">• Clients: {item.clientNames.join(', ')}</span>
                              )}
                            </div>
                          </div>
                          {!hasFinancialChanges && !hasSignificantDisbursements && (
                            <Badge variant="secondary" className="text-xs">
                              No changes
                            </Badge>
                          )}
                          {!hasFinancialChanges && hasSignificantDisbursements && (
                            <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-300">
                              Disbursements only
                            </Badge>
                          )}
                        </div>

                        {/* Expanded Field Details */}
                        {isExpanded && (hasFinancialChanges || hasSignificantDisbursements) && (
                          <div className="ml-12 mt-2 pl-3 border-l-2 border-muted">
                            {hasFinancialChanges && (
                              <>
                                {renderFieldChange(item, 'wip', 'WIP')}
                                {renderFieldChange(item, 'wipWriteOff', 'Write-off')}
                                {renderFieldChange(item, 'accountsReceivable', 'AR')}
                                {renderFieldChange(item, 'totalBilled', 'Billed')}
                                {renderFieldChange(item, 'totalPaid', 'Paid')}
                              </>
                            )}
                            {hasSignificantDisbursements && (
                              <div className="mt-2 pt-2 border-t border-muted">
                                <div className="text-xs font-medium text-rose-700 dark:text-rose-400 mb-1">Disbursements (potential local counsel fees):</div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  {(item.wipDisbursement || 0) > 0 && (
                                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded">
                                      <div className="text-muted-foreground">WIP Disb</div>
                                      <div className="font-medium">{formatCurrency(item.wipDisbursement || 0, item.currency)}</div>
                                    </div>
                                  )}
                                  {(item.arDisbursement || 0) > 0 && (
                                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded">
                                      <div className="text-muted-foreground">AR Disb</div>
                                      <div className="font-medium">{formatCurrency(item.arDisbursement || 0, item.currency)}</div>
                                    </div>
                                  )}
                                  {(item.paidDisbursement || 0) > 0 && (
                                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded">
                                      <div className="text-muted-foreground">Paid Disb</div>
                                      <div className="font-medium">{formatCurrency(item.paidDisbursement || 0, item.currency)}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Immaterial Changes Section - Always show header for visual separation */}
                  <div className="border-t-4 border-dashed border-muted-foreground/20 mt-2">
                    <div className="p-3 bg-background sticky top-0 z-10 before:absolute before:inset-0 before:bg-muted/40 before:-z-10 relative">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span>Immaterial Changes ({filteredImmaterialData.length})</span>
                        <span className="text-xs font-normal">— small corrections (≤2%) to ensure data accuracy</span>
                      </div>
                    </div>
                    {filteredImmaterialData.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground bg-muted/10">
                        No immaterial changes detected
                      </div>
                    ) : (
                      <div className="divide-y divide-muted/30">
                        {filteredImmaterialData.map((item) => {
                          const hasFinancialChanges = item.wip.changed || item.wipWriteOff?.changed ||
                                             item.accountsReceivable.changed || 
                                             item.totalBilled.changed || item.totalPaid.changed;
                          const isExpanded = expandedRows.has(item.rowIndex);

                          return (
                            <div 
                              key={item.rowIndex} 
                              className={cn(
                                'p-3 bg-muted/10',
                                !item.selected && 'opacity-60'
                              )}
                            >
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
                                    <span className="font-medium truncate text-muted-foreground">
                                      {item.matchedMatterName || item.matterName}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                                      Immaterial
                                    </Badge>
                                    {item.isMultiClientAggregate && (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                        <Users className="h-3 w-3" />
                                        {item.rowIndices?.length || 1} clients aggregated
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {item.matterNumber}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Field Details */}
                              {isExpanded && (hasFinancialChanges || item.hasMinorLcDifference) && (
                                <div className="ml-12 mt-2 pl-3 border-l-2 border-muted">
                                  {renderFieldChange(item, 'wip', 'WIP')}
                                  {renderFieldChange(item, 'wipWriteOff', 'Write-off')}
                                  {renderFieldChange(item, 'accountsReceivable', 'AR')}
                                  {renderFieldChange(item, 'totalBilled', 'Billed')}
                                  {renderFieldChange(item, 'totalPaid', 'Paid')}
                                  {item.hasMinorLcDifference && (
                                    <div className="text-xs text-muted-foreground mt-1 italic">
                                      Note: Disbursements match existing LC fees (minor ≤2% variance)
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

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
                    {stats.totalChanges} change{stats.totalChanges !== 1 ? 's' : ''} selected
                    {stats.immaterialCount > 0 && (
                      <span className="text-xs ml-1">({stats.immaterialCount} immaterial)</span>
                    )}
                  </span>
                  <Button onClick={handleApply} disabled={isSubmitting || stats.totalChanges === 0}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      `Apply ${stats.totalChanges} Changes`
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

      {/* Disbursement Review Dialog */}
      <DisbursementReviewDialog
        isOpen={showDisbursementReview}
        onClose={() => {
          setShowDisbursementReview(false);
          // Don't apply updates if user cancels disbursement review
          setPendingUpdates([]);
          setDisbursementData([]);
        }}
        onComplete={handleDisbursementReviewComplete}
        disbursements={disbursementData}
        threshold={DISBURSEMENT_THRESHOLD}
      />

      {/* Manual Data Overwrite Confirmation Dialog */}
      <AlertDialog open={showManualOverwriteConfirm} onOpenChange={setShowManualOverwriteConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Manual Data Will Be Overwritten
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  The following {mattersWithManualData.length} matter{mattersWithManualData.length !== 1 ? 's have' : ' has'} financial 
                  data that was manually entered. Proceeding will overwrite this data with the imported values.
                </p>
                <div className="max-h-40 overflow-auto border rounded-lg divide-y">
                  {mattersWithManualData.map((matter) => (
                    <div key={matter.rowIndex} className="p-2 text-sm">
                      <div className="font-medium text-foreground">{matter.matchedMatterName || matter.matterName}</div>
                      <div className="text-xs text-muted-foreground">
                        {matter.matterNumber}
                        {matter.lastManualUpdateDate && (
                          <span className="ml-2">
                            • Last manual update: {new Date(matter.lastManualUpdateDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-amber-700">
                  Are you sure you want to proceed?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelManualOverwrite}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmManualOverwrite}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Yes, Overwrite Manual Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
