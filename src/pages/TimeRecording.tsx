import { useState, useMemo, useEffect } from 'react';
import { format, addDays, differenceInDays, eachDayOfInterval, parseISO } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import { useMatters } from '@/lib/hooks/useMatters';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { WorkItemAllocator } from '@/components/time-recording/WorkItemAllocator';
import { useTimeRecordingDrafts, TimeRecordingDraft } from '@/lib/hooks/useTimeRecordingDrafts';
import { getMatterClientDisplayName } from '@/lib/clientUtils';
import { 
  CalendarIcon, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  Loader2,
  FileText,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Target,
  ChevronDown,
  Save,
  Trash2,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Non-chargeable codes
const NON_CHARGEABLE_CODES = [
  { code: '98444444-3', name: 'Business Development' },
  { code: '', name: 'New Matter Onboarding' },
  { code: '', name: 'Travel for Clients' },
  { code: '98444444-8', name: 'Firm Meetings' },
  { code: '', name: 'Pro Bono' },
  { code: '98444444-1', name: 'Admin' },
  { code: '98444444-13', name: 'Annual Leave' },
  { code: '98444444-5', name: 'L&D / Training' },
  { code: 'OTHER', name: 'Other' },
];

interface BudgetLineItem {
  id: string;
  work_item: string;
  fee_amount: number;
  category: string | null;
  provider: string;
  sort_order: number;
}

interface WorkItemAllocation {
  id: string;
  name: string;
  hours: number;
}

interface GridRowEntry {
  id: string;
  type: 'matter' | 'non-chargeable';
  matterId?: string;
  matterNumber?: string;
  matterName?: string;
  clientName?: string;
  cmNumber?: string;
  nonChargeableCode?: string;
  nonChargeableName?: string;
  hours: number;
  // For single-day: just one narrative
  narrative: string;
  // For multi-day: selected days and narratives per day
  selectedDays: Date[];
  dayNarratives: { [dateKey: string]: string };
  otherDescription?: string;
  // Work item allocations (multi-select with hour distribution)
  workItemAllocations: WorkItemAllocation[];
  // For multi-day: work item allocations per day
  dayWorkItemAllocations: { [dateKey: string]: WorkItemAllocation[] };
}

interface DayOutputEntry {
  id: string;
  type: 'matter' | 'non-chargeable';
  matterId?: string;
  matterNumber?: string;
  matterName?: string;
  clientName?: string;
  cmNumber?: string;
  nonChargeableCode?: string;
  nonChargeableName?: string;
  otherDescription?: string;
  hours: number;
  narrative: string;
  polishedNarrative: string;
  workItemName?: string;
}

interface DayOutput {
  date: Date;
  entries: DayOutputEntry[];
}

type Step = 'mode-select' | 'grid-input' | 'output';

export default function TimeRecording() {
  const { toast } = useToast();
  const { matters, isLoading: mattersLoading } = useMatters();
  const { user } = useAuth();
  
  // Step state
  const [step, setStep] = useState<Step>('mode-select');
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drafts
  const { drafts, isLoading: draftsLoading, saveDraft, deleteDraft, deleteAllDrafts } = useTimeRecordingDrafts();
  
  // Date state
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Grid entries - one row per matter/non-chargeable
  const [gridEntries, setGridEntries] = useState<GridRowEntry[]>([]);
  
  // Budget line items per matter
  const [matterBudgetItems, setMatterBudgetItems] = useState<{ [matterId: string]: BudgetLineItem[] }>({});
  const [loadingBudgetItems, setLoadingBudgetItems] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedOutput, setProcessedOutput] = useState<DayOutput[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter only live matters
  const liveMatters = useMemo(() => 
    matters?.filter(m => m.category === 'Live') || [], 
    [matters]
  );

  // Get all dates in range for multi-day
  const datesInRange = useMemo(() => {
    if (mode !== 'multi' || !dateRange.from || !dateRange.to) return [];
    return eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
  }, [mode, dateRange]);

  // Hours targets: minimum 8 per day, ideal 10 per day
  const HOURS_MINIMUM_PER_DAY = 8;
  const HOURS_IDEAL_PER_DAY = 10;
  
  // Calculate number of days being recorded
  const numberOfDays = useMemo(() => {
    if (mode === 'single') return 1;
    return datesInRange.length || 1;
  }, [mode, datesInRange]);

  // Calculate hours targets based on number of days
  const hoursMinimum = numberOfDays * HOURS_MINIMUM_PER_DAY;
  const hoursIdeal = numberOfDays * HOURS_IDEAL_PER_DAY;

  // Get hours status for color coding
  const getHoursStatus = (hours: number): 'critical' | 'warning' | 'good' => {
    if (hours < hoursMinimum) return 'critical';
    if (hours < hoursIdeal) return 'warning';
    return 'good';
  };

  // Fetch budget items for all live matters
  useEffect(() => {
    const fetchBudgetItems = async () => {
      if (!user || liveMatters.length === 0) return;
      
      setLoadingBudgetItems(true);
      try {
        // Get all matter IDs
        const matterIds = liveMatters.map(m => m.id);
        
        // Fetch current budget versions for each matter
        const { data: versions, error: versionsError } = await supabase
          .from('budget_versions')
          .select('id, matter_id')
          .in('matter_id', matterIds)
          .eq('user_id', user.id)
          .order('version_number', { ascending: false });
        
        if (versionsError) throw versionsError;
        
        // Get the latest version per matter
        const latestVersions: { [matterId: string]: string } = {};
        versions?.forEach(v => {
          if (!latestVersions[v.matter_id]) {
            latestVersions[v.matter_id] = v.id;
          }
        });
        
        // Fetch budget line items for these versions
        const versionIds = Object.values(latestVersions);
        if (versionIds.length === 0) {
          setMatterBudgetItems({});
          return;
        }
        
        const { data: items, error: itemsError } = await supabase
          .from('budget_line_items')
          .select('id, work_item, fee_amount, category, provider, matter_id, is_included, sort_order')
          .in('budget_version_id', versionIds)
          .eq('is_included', true)
          .order('sort_order', { ascending: true });
        
        if (itemsError) throw itemsError;
        
        // Group by matter_id
        const grouped: { [matterId: string]: BudgetLineItem[] } = {};
        items?.forEach(item => {
          if (!grouped[item.matter_id]) {
            grouped[item.matter_id] = [];
          }
          grouped[item.matter_id].push({
            id: item.id,
            work_item: item.work_item,
            fee_amount: item.fee_amount,
            category: item.category,
            provider: item.provider,
            sort_order: item.sort_order,
          });
        });
        
        setMatterBudgetItems(grouped);
      } catch (err) {
        console.error('Error fetching budget items:', err);
      } finally {
        setLoadingBudgetItems(false);
      }
    };
    
    fetchBudgetItems();
  }, [user, liveMatters]);

  // Initialize grid with all matters and non-chargeable codes
  const initializeGrid = () => {
    const entries: GridRowEntry[] = [];
    
    // Add all live matters
    liveMatters.forEach(matter => {
      entries.push({
        id: `matter-${matter.id}`,
        type: 'matter',
        matterId: matter.id,
        matterNumber: matter.matter_number,
        matterName: matter.matter_name,
        clientName: getMatterClientDisplayName(matter),
        cmNumber: matter.cm_number || undefined,
        hours: 0,
        narrative: '',
        selectedDays: [],
        dayNarratives: {},
        workItemAllocations: [],
        dayWorkItemAllocations: {},
      });
    });
    
    // Add all non-chargeable codes
    NON_CHARGEABLE_CODES.forEach(nc => {
      entries.push({
        id: `nc-${nc.name}`,
        type: 'non-chargeable',
        nonChargeableCode: nc.code,
        nonChargeableName: nc.name,
        hours: 0,
        narrative: '',
        selectedDays: [],
        dayNarratives: {},
        otherDescription: '',
        workItemAllocations: [],
        dayWorkItemAllocations: {},
      });
    });
    
    setGridEntries(entries);
  };

  const selectMode = (selectedMode: 'single' | 'multi') => {
    setMode(selectedMode);
    setCurrentDraftId(null);
    initializeGrid();
    setStep('grid-input');
    setProcessedOutput(null);
  };

  // Load a draft
  const loadDraft = (draft: TimeRecordingDraft) => {
    setMode(draft.mode as 'single' | 'multi');
    setCurrentDraftId(draft.id);
    
    if (draft.single_date) {
      setSingleDate(parseISO(draft.single_date));
    }
    if (draft.date_range_from && draft.date_range_to) {
      setDateRange({
        from: parseISO(draft.date_range_from),
        to: parseISO(draft.date_range_to),
      });
    }
    
    // Restore grid entries, converting date strings back to Date objects
    const restoredEntries = (draft.grid_entries as GridRowEntry[]).map(entry => ({
      ...entry,
      selectedDays: entry.selectedDays?.map((d: any) => 
        typeof d === 'string' ? parseISO(d) : new Date(d)
      ) || [],
    }));
    setGridEntries(restoredEntries);
    
    // Restore processed output if polished
    if (draft.is_polished && draft.processed_output) {
      const restoredOutput = (draft.processed_output as DayOutput[]).map(day => ({
        ...day,
        date: typeof day.date === 'string' ? parseISO(day.date as any) : new Date(day.date),
      }));
      setProcessedOutput(restoredOutput);
      setStep('output');
    } else {
      setProcessedOutput(null);
      setStep('grid-input');
    }
    
    toast({
      title: 'Draft loaded',
      description: `Loaded "${draft.name}"`,
    });
  };

  // Save current state as draft
  const handleSaveDraft = async () => {
    if (!mode) return;
    
    setIsSaving(true);
    try {
      // Generate a default name based on date
      const defaultName = mode === 'single' 
        ? `Time for ${format(singleDate, 'd MMM yyyy')}`
        : dateRange.from && dateRange.to
          ? `Time for ${format(dateRange.from, 'd MMM')} - ${format(dateRange.to, 'd MMM yyyy')}`
          : `Time recording ${format(new Date(), 'd MMM yyyy HH:mm')}`;
      
      // Serialize grid entries, converting Dates to ISO strings
      const serializedEntries = gridEntries.map(entry => ({
        ...entry,
        selectedDays: entry.selectedDays.map(d => d.toISOString()),
      }));
      
      // Serialize processed output if exists
      const serializedOutput = processedOutput?.map(day => ({
        ...day,
        date: day.date.toISOString(),
      })) || null;
      
      await saveDraft.mutateAsync({
        id: currentDraftId || undefined,
        name: defaultName,
        mode,
        singleDate: mode === 'single' ? singleDate : null,
        dateRangeFrom: mode === 'multi' ? dateRange.from || null : null,
        dateRangeTo: mode === 'multi' ? dateRange.to || null : null,
        gridEntries: serializedEntries,
        processedOutput: serializedOutput,
        isPolished: !!processedOutput,
      });
      
      // If this was a new draft, we need to get the ID from the response
      // The hook will refetch the drafts list
    } catch (err) {
      console.error('Save draft error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateEntry = (id: string, updates: Partial<GridRowEntry>) => {
    setGridEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const toggleDay = (entryId: string, date: Date) => {
    setGridEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      
      const dateKey = format(date, 'yyyy-MM-dd');
      const isSelected = entry.selectedDays.some(d => format(d, 'yyyy-MM-dd') === dateKey);
      
      if (isSelected) {
        // Remove day
        const newSelectedDays = entry.selectedDays.filter(d => format(d, 'yyyy-MM-dd') !== dateKey);
        const newDayNarratives = { ...entry.dayNarratives };
        const newDayWorkItemAllocations = { ...entry.dayWorkItemAllocations };
        delete newDayNarratives[dateKey];
        delete newDayWorkItemAllocations[dateKey];
        return { ...entry, selectedDays: newSelectedDays, dayNarratives: newDayNarratives, dayWorkItemAllocations: newDayWorkItemAllocations };
      } else {
        // Add day
        return { 
          ...entry, 
          selectedDays: [...entry.selectedDays, date].sort((a, b) => a.getTime() - b.getTime()),
          dayNarratives: { ...entry.dayNarratives, [dateKey]: '' },
          dayWorkItemAllocations: { ...entry.dayWorkItemAllocations, [dateKey]: [] }
        };
      }
    }));
  };

  const updateDayNarrative = (entryId: string, date: Date, narrative: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setGridEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      return { 
        ...entry, 
        dayNarratives: { ...entry.dayNarratives, [dateKey]: narrative }
      };
    }));
  };

  const updateDayWorkItemAllocations = (entryId: string, date: Date, allocations: WorkItemAllocation[]) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setGridEntries(prev => prev.map(entry => {
      if (entry.id !== entryId) return entry;
      return { 
        ...entry, 
        dayWorkItemAllocations: { ...entry.dayWorkItemAllocations, [dateKey]: allocations }
      };
    }));
  };

  const polishNarrative = async (narrative: string): Promise<string> => {
    if (!narrative.trim()) return '';
    try {
      const { data, error } = await supabase.functions.invoke('polish-narrative', {
        body: { narrative }
      });
      
      if (error) throw error;
      return data.polishedNarrative || narrative;
    } catch (err) {
      console.error('Error polishing narrative:', err);
      return narrative;
    }
  };

  // Even time spreading - divides hours equally across selected days
  // Rounds to nearest 0.25 (15 mins) and ensures total matches input
  const spreadTimeAcrossDays = (totalHours: number, dayCount: number): number[] => {
    if (dayCount === 0) return [];
    if (dayCount === 1) return [totalHours];
    
    // Simply divide equally, round to 0.25 increments
    const baseHours = totalHours / dayCount;
    const roundedBase = Math.round(baseHours * 4) / 4; // Round to nearest 0.25
    
    const result: number[] = [];
    let allocated = 0;
    
    for (let i = 0; i < dayCount; i++) {
      if (i === dayCount - 1) {
        // Last day gets whatever remains to ensure exact total
        const remaining = Math.round((totalHours - allocated) * 4) / 4;
        result.push(remaining);
      } else {
        result.push(roundedBase);
        allocated += roundedBase;
      }
    }
    
    return result;
  };

  const processEntries = async () => {
    const totalHours = getTotalHours();
    const hoursStatus = getHoursStatus(totalHours);
    
    // Show warning if hours are below target, but allow to proceed
    if (hoursStatus === 'critical') {
      const shortfall = hoursMinimum - totalHours;
      toast({
        title: "⚠️ Hours Below Minimum Target",
        description: `You've recorded ${totalHours.toFixed(1)}h but need at least ${hoursMinimum}h (${shortfall.toFixed(1)}h short). Consider adding more time to reach your target.`,
        variant: "destructive"
      });
    } else if (hoursStatus === 'warning') {
      const toIdeal = hoursIdeal - totalHours;
      toast({
        title: "📊 Hours Below Ideal Target",
        description: `You've recorded ${totalHours.toFixed(1)}h. Add ${toIdeal.toFixed(1)}h more to hit the ideal ${hoursIdeal}h target.`,
      });
    }
    
    setIsProcessing(true);
    
    try {
      // Get entries with hours > 0
      const activeEntries = gridEntries.filter(e => e.hours > 0);
      
      if (activeEntries.length === 0) {
        toast({
          title: "No entries",
          description: "Please add hours to at least one entry.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      if (mode === 'single') {
        // Single day: polish narratives and output
        // For multi-work-item allocations, we need to create separate entries for each allocated work item
        const polishedEntries: DayOutputEntry[] = [];
        
        for (const entry of activeEntries) {
          const polished = await polishNarrative(entry.narrative);
          
          if (entry.type === 'matter' && entry.workItemAllocations.length > 0) {
            // Create separate output entries for each work item allocation
            for (const allocation of entry.workItemAllocations) {
              if (allocation.hours > 0) {
                polishedEntries.push({
                  id: `${entry.id}-${allocation.id}`,
                  type: entry.type,
                  matterId: entry.matterId,
                  matterNumber: entry.matterNumber,
                  matterName: entry.matterName,
                  clientName: entry.clientName,
                  cmNumber: entry.cmNumber,
                  hours: allocation.hours,
                  narrative: entry.narrative,
                  polishedNarrative: polished,
                  workItemName: allocation.name,
                });
              }
            }
          } else {
            // Non-matter entries or entries without allocations
            polishedEntries.push({
              id: entry.id,
              type: entry.type,
              matterId: entry.matterId,
              matterNumber: entry.matterNumber,
              matterName: entry.matterName,
              clientName: entry.clientName,
              cmNumber: entry.cmNumber,
              nonChargeableCode: entry.nonChargeableCode,
              nonChargeableName: entry.nonChargeableName,
              otherDescription: entry.otherDescription,
              hours: entry.hours,
              narrative: entry.narrative,
              polishedNarrative: polished,
              workItemName: undefined,
            });
          }
        }

        setProcessedOutput([{
          date: singleDate,
          entries: polishedEntries,
        }]);
      } else {
        // Multi-day processing
        if (datesInRange.length === 0) {
          toast({
            title: "Select dates",
            description: "Please select a date range.",
            variant: "destructive"
          });
          setIsProcessing(false);
          return;
        }

        // Check that entries with hours have days selected
        const entriesWithoutDays = activeEntries.filter(e => e.selectedDays.length === 0);
        if (entriesWithoutDays.length > 0) {
          toast({
            title: "Select days",
            description: "Please select which days to apply time for each entry with hours.",
            variant: "destructive"
          });
          setIsProcessing(false);
          return;
        }

        // Build output per day
        const outputMap: { [dateKey: string]: DayOutput['entries'] } = {};
        datesInRange.forEach(d => {
          outputMap[format(d, 'yyyy-MM-dd')] = [];
        });

        // Process each active entry
        for (const entry of activeEntries) {
          const dayCount = entry.selectedDays.length;
          const hoursPerDay = spreadTimeAcrossDays(entry.hours, dayCount);
          
          // Polish narratives for each day
          for (let i = 0; i < entry.selectedDays.length; i++) {
            const date = entry.selectedDays[i];
            const dateKey = format(date, 'yyyy-MM-dd');
            const rawNarrative = entry.dayNarratives[dateKey] || '';
            const polished = await polishNarrative(rawNarrative);
            const dayAllocations = entry.dayWorkItemAllocations[dateKey] || [];
            
            if (entry.type === 'matter' && dayAllocations.length > 0) {
              // Create separate output entries for each work item allocation
              for (const allocation of dayAllocations) {
                if (allocation.hours > 0) {
                  outputMap[dateKey].push({
                    id: `${entry.id}-${dateKey}-${allocation.id}`,
                    type: entry.type,
                    matterId: entry.matterId,
                    matterNumber: entry.matterNumber,
                    matterName: entry.matterName,
                    clientName: entry.clientName,
                    cmNumber: entry.cmNumber,
                    hours: allocation.hours,
                    narrative: rawNarrative,
                    polishedNarrative: polished,
                    workItemName: allocation.name,
                  });
                }
              }
            } else {
              // Non-matter entries or entries without allocations
              outputMap[dateKey].push({
                id: `${entry.id}-${dateKey}`,
                type: entry.type,
                matterId: entry.matterId,
                matterNumber: entry.matterNumber,
                matterName: entry.matterName,
                clientName: entry.clientName,
                cmNumber: entry.cmNumber,
                nonChargeableCode: entry.nonChargeableCode,
                nonChargeableName: entry.nonChargeableName,
                otherDescription: entry.otherDescription,
                hours: hoursPerDay[i],
                narrative: rawNarrative,
                polishedNarrative: polished,
                workItemName: undefined,
              });
            }
          }
        }

        // Convert to array, only include days with entries
        const outputs: DayOutput[] = datesInRange
          .map(d => ({
            date: d,
            entries: outputMap[format(d, 'yyyy-MM-dd')],
          }))
          .filter(d => d.entries.length > 0);

        setProcessedOutput(outputs);
      }

      setStep('output');
      toast({
        title: "Processing complete",
        description: "Your time entries have been processed with polished narratives.",
      });
    } catch (err) {
      console.error('Error processing:', err);
      toast({
        title: "Error",
        description: "Failed to process time entries. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatOutputForClipboard = (): string => {
    if (!processedOutput) return '';

    let output = '';
    
    for (const day of processedOutput) {
      output += `═══════════════════════════════════════════════════════════════\n`;
      output += `DATE: ${format(day.date, 'EEEE, d MMMM yyyy')}\n`;
      output += `═══════════════════════════════════════════════════════════════\n\n`;

      if (day.entries.length === 0) {
        output += `No time recorded\n\n`;
        continue;
      }

      let lastMatterId: string | null = null;

      for (const entry of day.entries) {
        if (entry.type === 'matter') {
          // Only show client/matter header if different from previous entry
          const isNewMatter = entry.matterId !== lastMatterId;
          
          if (isNewMatter) {
            if (lastMatterId !== null) {
              // Add extra spacing between matters
              output += `\n`;
            }
            output += `CLIENT: ${entry.clientName || 'N/A'}\n`;
            output += `MATTER: ${entry.matterName || 'N/A'}\n`;
            output += `MATTER NUMBER: ${entry.cmNumber || 'N/A'}\n`;
            output += `───────────────────────────────────────────────────────────────\n`;
            lastMatterId = entry.matterId || null;
          }
          
          if (entry.workItemName) {
            output += `  • WORK ITEM: ${entry.workItemName}\n`;
          }
          output += `    TIME: ${entry.hours} hours\n`;
          output += `    NARRATIVE:\n    ${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '\n    ')}\n\n`;
        } else {
          // Non-chargeable entries reset the matter tracking
          lastMatterId = null;
          const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
          output += `NON-CHARGEABLE: ${entry.nonChargeableName}${code}\n`;
          if (entry.otherDescription) {
            output += `Description: ${entry.otherDescription}\n`;
          }
          output += `TIME: ${entry.hours} hours\n`;
          output += `NARRATIVE:\n${entry.polishedNarrative || entry.narrative}\n`;
          output += `───────────────────────────────────────────────────────────────\n\n`;
        }
      }
    }

    return output;
  };

  // Format output as HTML for rich pasting into Outlook
  const formatOutputAsHtml = (): string => {
    if (!processedOutput) return '';

    let html = `
      <html>
        <head>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
            .day-header { background-color: #1e3a5f; color: white; padding: 8px 12px; margin-top: 16px; font-weight: bold; }
            .matter-block { border: 1px solid #ddd; margin-bottom: 12px; }
            .matter-header { background-color: #f5f5f5; padding: 8px 12px; border-bottom: 1px solid #ddd; }
            .work-item-entry { padding: 8px 12px; border-bottom: 1px solid #eee; }
            .work-item-entry:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; }
            .client-name { font-weight: bold; color: #1e3a5f; font-size: 12pt; }
            .matter-name { font-weight: 600; }
            .work-item-name { color: #059669; font-weight: 500; }
            .hours { font-weight: bold; color: #2563eb; }
            .narrative { margin-top: 4px; line-height: 1.4; padding-left: 8px; border-left: 2px solid #e5e7eb; }
            .non-chargeable { color: #ea580c; font-weight: bold; }
            .non-chargeable-block { border: 1px solid #fed7aa; margin-bottom: 12px; }
            .non-chargeable-header { background-color: #fff7ed; padding: 8px 12px; border-bottom: 1px solid #fed7aa; }
            table { border-collapse: collapse; width: 100%; }
            td { padding: 2px 8px; vertical-align: top; }
            .label-col { width: 100px; }
          </style>
        </head>
        <body>
    `;

    for (const day of processedOutput) {
      html += `<div class="day-header">${format(day.date, 'EEEE, d MMMM yyyy')}</div>`;

      if (day.entries.length === 0) {
        html += `<p><em>No time recorded</em></p>`;
        continue;
      }

      // Group entries by matter
      let currentMatterId: string | null = null;
      let matterBlockOpen = false;

      for (let i = 0; i < day.entries.length; i++) {
        const entry = day.entries[i];
        const nextEntry = day.entries[i + 1];
        
        if (entry.type === 'matter') {
          const isNewMatter = entry.matterId !== currentMatterId;
          const isLastOfMatter = !nextEntry || nextEntry.type !== 'matter' || nextEntry.matterId !== entry.matterId;
          
          if (isNewMatter) {
            // Close previous matter block if open
            if (matterBlockOpen) {
              html += `</div>`; // Close matter-block
            }
            
            // Start new matter block
            html += `<div class="matter-block">`;
            html += `<div class="matter-header">`;
            html += `<table>`;
            html += `<tr><td class="label-col"><span class="label">Client:</span></td><td><span class="client-name">${entry.clientName || 'N/A'}</span></td></tr>`;
            html += `<tr><td class="label-col"><span class="label">Matter:</span></td><td><span class="matter-name">${entry.matterName || 'N/A'}</span></td></tr>`;
            html += `<tr><td class="label-col"><span class="label">Matter No:</span></td><td>${entry.cmNumber || 'N/A'}</td></tr>`;
            html += `</table>`;
            html += `</div>`; // Close matter-header
            
            currentMatterId = entry.matterId || null;
            matterBlockOpen = true;
          }
          
          // Add work item entry
          html += `<div class="work-item-entry">`;
          if (entry.workItemName) {
            html += `<div><span class="label">Work Item:</span> <span class="work-item-name">${entry.workItemName}</span></div>`;
          }
          html += `<div><span class="label">Time:</span> <span class="hours">${entry.hours} hours</span></div>`;
          html += `<div class="narrative">${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '<br>')}</div>`;
          html += `</div>`; // Close work-item-entry
          
          // Close matter block if this is the last entry for this matter
          if (isLastOfMatter && matterBlockOpen) {
            html += `</div>`; // Close matter-block
            matterBlockOpen = false;
            currentMatterId = null;
          }
        } else {
          // Non-chargeable entry - close any open matter block first
          if (matterBlockOpen) {
            html += `</div>`; // Close matter-block
            matterBlockOpen = false;
            currentMatterId = null;
          }
          
          const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
          html += `<div class="non-chargeable-block">`;
          html += `<div class="non-chargeable-header">`;
          html += `<table>`;
          html += `<tr><td class="label-col"><span class="label">Code:</span></td><td><span class="non-chargeable">${entry.nonChargeableName}${code}</span></td></tr>`;
          if (entry.otherDescription) {
            html += `<tr><td class="label-col"><span class="label">Description:</span></td><td>${entry.otherDescription}</td></tr>`;
          }
          html += `<tr><td class="label-col"><span class="label">Time:</span></td><td><span class="hours">${entry.hours} hours</span></td></tr>`;
          html += `</table>`;
          html += `</div>`;
          html += `<div class="work-item-entry">`;
          html += `<div class="narrative">${(entry.polishedNarrative || entry.narrative).replace(/\n/g, '<br>')}</div>`;
          html += `</div>`;
          html += `</div>`; // Close non-chargeable-block
        }
      }
      
      // Close any remaining open matter block
      if (matterBlockOpen) {
        html += `</div>`;
      }
    }

    html += `</body></html>`;
    return html;
  };

  // Update a polished narrative in the output
  const updatePolishedNarrative = (dayIndex: number, entryId: string, newNarrative: string) => {
    if (!processedOutput) return;
    
    setProcessedOutput(prev => {
      if (!prev) return prev;
      return prev.map((day, dIdx) => {
        if (dIdx !== dayIndex) return day;
        return {
          ...day,
          entries: day.entries.map(entry => 
            entry.id === entryId 
              ? { ...entry, polishedNarrative: newNarrative }
              : entry
          )
        };
      });
    });
  };

  const copyToClipboard = async () => {
    const plainText = formatOutputForClipboard();
    const htmlContent = formatOutputAsHtml();
    
    try {
      // Try to copy both HTML and plain text for rich pasting
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ]);
      setCopied(true);
      toast({
        title: "Copied with formatting!",
        description: "Paste into Outlook for nicely formatted output.",
      });
    } catch (err) {
      // Fallback to plain text if HTML copy fails
      console.warn('Rich copy failed, falling back to plain text:', err);
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Time recording output copied to clipboard.",
      });
    }
    
    setTimeout(() => setCopied(false), 2000);
  };

  const startOver = () => {
    setStep('mode-select');
    setMode(null);
    setCurrentDraftId(null);
    setGridEntries([]);
    setProcessedOutput(null);
    setDateRange({ from: undefined, to: undefined });
  };

  // Go back to grid input from output (keeps all data intact)
  const goBackToInput = () => {
    setStep('grid-input');
    setProcessedOutput(null);
  };

  const getTotalHours = () => gridEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Render mode selection
  const renderModeSelect = () => (
    <div className="flex flex-col items-center justify-center space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">How are you recording time today?</h2>
        <p className="text-muted-foreground">Choose your time recording mode</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors group"
          onClick={() => selectMode('single')}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <CalendarIcon className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Single Day</CardTitle>
            <CardDescription>
              Record time for one specific day
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="ghost" className="group-hover:bg-primary group-hover:text-primary-foreground">
              Select <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors group"
          onClick={() => selectMode('multi')}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Multi-Day</CardTitle>
            <CardDescription>
              Spread time across multiple days
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="ghost" className="group-hover:bg-primary group-hover:text-primary-foreground">
              Select <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Saved Drafts Section */}
      {drafts.length > 0 && (
        <div className="w-full max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Saved Drafts</h3>
              <Badge variant="secondary">{drafts.length}</Badge>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all drafts?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {drafts.length} saved time recording drafts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllDrafts.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          
          <div className="grid gap-3">
            {drafts.map(draft => (
              <Card key={draft.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => loadDraft(draft)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          draft.is_polished ? "bg-green-500" : "bg-amber-500"
                        )} />
                        <div>
                          <p className="font-medium">{draft.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {draft.mode === 'single' ? 'Single Day' : 'Multi-Day'}
                            </Badge>
                            <span>•</span>
                            <span>{draft.is_polished ? 'Polished' : 'Draft'}</span>
                            <span>•</span>
                            <span>Updated {format(new Date(draft.updated_at), 'd MMM yyyy HH:mm')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => loadDraft(draft)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{draft.name}". This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteDraft.mutate(draft.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {draftsLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading saved drafts...</span>
        </div>
      )}
    </div>
  );

  // Render the grid input
  const renderGridInput = () => (
    <div className="space-y-6">
      {/* Date selection header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {mode === 'single' ? 'Select Date' : 'Select Date Range'}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={startOver}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'single' ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full md:w-auto justify-start text-left font-normal",
                    !singleDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {singleDate ? format(singleDate, "EEEE, d MMMM yyyy") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={singleDate}
                  onSelect={(date) => date && setSingleDate(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex flex-wrap gap-4 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "d MMM") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "d MMM") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    disabled={(date) => dateRange.from ? date < dateRange.from : false}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {datesInRange.length > 0 && (
                <Badge variant="secondary">{datesInRange.length} days</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total hours summary with target tracking */}
      {(() => {
        const totalHours = getTotalHours();
        const hoursStatus = getHoursStatus(totalHours);
        const statusColors = {
          critical: 'bg-destructive/10 border-destructive/50',
          warning: 'bg-yellow-500/10 border-yellow-500/50',
          good: 'bg-green-500/10 border-green-500/50'
        };
        const textColors = {
          critical: 'text-destructive',
          warning: 'text-yellow-600 dark:text-yellow-400',
          good: 'text-green-600 dark:text-green-400'
        };
        const progressPercent = Math.min((totalHours / hoursIdeal) * 100, 100);
        
        return (
          <div className={cn("p-4 rounded-lg border-2 space-y-3", statusColors[hoursStatus])}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Total Hours:</span>
                  <span className={cn("text-2xl font-bold", textColors[hoursStatus])}>
                    {totalHours.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span>Target: {hoursMinimum}h min / {hoursIdeal}h ideal</span>
                  {numberOfDays > 1 && (
                    <Badge variant="outline" className="ml-1">
                      {numberOfDays} days × {HOURS_MINIMUM_PER_DAY}-{HOURS_IDEAL_PER_DAY}h
                    </Badge>
                  )}
                </div>
              </div>
              <Button 
                onClick={processEntries} 
                disabled={isProcessing || totalHours === 0}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Process & Polish Narratives
                  </>
                )}
              </Button>
            </div>
            
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0h</span>
                <span className={hoursStatus === 'critical' ? 'font-semibold text-destructive' : ''}>
                  {hoursMinimum}h minimum
                </span>
                <span className={hoursStatus === 'warning' ? 'font-semibold text-yellow-600 dark:text-yellow-400' : ''}>
                  {hoursIdeal}h ideal
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                {/* Minimum marker */}
                <div 
                  className="absolute h-full w-0.5 bg-foreground/30 z-10"
                  style={{ left: `${(hoursMinimum / hoursIdeal) * 100}%` }}
                />
                {/* Progress fill */}
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    hoursStatus === 'critical' && 'bg-destructive',
                    hoursStatus === 'warning' && 'bg-yellow-500',
                    hoursStatus === 'good' && 'bg-green-500'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            {/* Status message */}
            {hoursStatus === 'critical' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {(hoursMinimum - totalHours).toFixed(1)}h short of minimum target. Add more time before processing.
                </span>
              </div>
            )}
            {hoursStatus === 'warning' && (
              <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {(hoursIdeal - totalHours).toFixed(1)}h short of ideal target. Consider adding more time.
                </span>
              </div>
            )}
            {hoursStatus === 'good' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span>Great! You've hit your ideal hours target.</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Main Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
          <CardDescription>
            Enter hours and narratives for each matter or activity. AI will polish your narratives.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[320px]">Client / Matter / Number</TableHead>
                  <TableHead className="w-[100px] text-center">Hours</TableHead>
                  {mode === 'single' ? (
                    <TableHead>Narrative</TableHead>
                  ) : (
                    <>
                      <TableHead className="text-center">Days</TableHead>
                      <TableHead>Narratives (one per day)</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Live Matters Section */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={mode === 'single' ? 3 : 4} className="font-semibold text-primary">
                    Live Matters ({liveMatters.length})
                  </TableCell>
                </TableRow>
                {gridEntries.filter(e => e.type === 'matter').map(entry => (
                  <TableRow key={entry.id} className={entry.hours > 0 ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-semibold text-primary">{entry.clientName || 'Unknown Client'}</div>
                        <div className="font-medium">{entry.matterName}</div>
                        <div className="text-sm text-muted-foreground">{entry.cmNumber || 'N/A'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={entry.hours || ''}
                        onChange={(e) => updateEntry(entry.id, { hours: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-20 text-center"
                      />
                    </TableCell>
                    {mode === 'single' ? (
                      <TableCell>
                        {entry.hours > 0 ? (
                          <div className="space-y-2">
                            {/* Work Item Allocator */}
                            {entry.matterId && matterBudgetItems[entry.matterId]?.length > 0 ? (
                              <WorkItemAllocator
                                budgetItems={matterBudgetItems[entry.matterId]}
                                totalHours={entry.hours}
                                allocations={entry.workItemAllocations}
                                onAllocationsChange={(allocations) => 
                                  updateEntry(entry.id, { workItemAllocations: allocations })
                                }
                              />
                            ) : entry.matterId && !matterBudgetItems[entry.matterId]?.length ? (
                              <div className="text-xs text-muted-foreground italic">
                                No budget items found
                              </div>
                            ) : null}
                            {/* Narrative Input - only show after work items selected (or if no budget items) */}
                            {(entry.workItemAllocations.length > 0 || !matterBudgetItems[entry.matterId]?.length) && (
                              <Input
                                placeholder="Brief notes - AI will polish"
                                value={entry.narrative}
                                onChange={(e) => updateEntry(entry.id, { narrative: e.target.value })}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Enter hours first</span>
                        )}
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {datesInRange.map(date => {
                              const dateKey = format(date, 'yyyy-MM-dd');
                              const isSelected = entry.selectedDays.some(d => format(d, 'yyyy-MM-dd') === dateKey);
                              return (
                                <div key={dateKey} className="flex flex-col items-center">
                                  <span className="text-[10px] text-muted-foreground mb-0.5">
                                    {format(date, 'EEE')}
                                  </span>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleDay(entry.id, date)}
                                    disabled={entry.hours === 0}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.selectedDays.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Select days first</span>
                          ) : (
                            <div className="space-y-4">
                              {entry.selectedDays.map(date => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                const dayAllocations = entry.dayWorkItemAllocations[dateKey] || [];
                                // Calculate hours per day evenly
                                const hoursPerDay = entry.hours / entry.selectedDays.length;
                                const roundedHoursPerDay = Math.round(hoursPerDay * 4) / 4;
                                
                                return (
                                  <div key={dateKey} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                                    <Badge variant="outline" className="text-xs">
                                      {format(date, 'EEE d MMM')} • {roundedHoursPerDay.toFixed(2)}h
                                    </Badge>
                                    
                                    {/* Work Item Allocator for each day */}
                                    {entry.matterId && matterBudgetItems[entry.matterId]?.length > 0 && (
                                      <WorkItemAllocator
                                        budgetItems={matterBudgetItems[entry.matterId]}
                                        totalHours={roundedHoursPerDay}
                                        allocations={dayAllocations}
                                        onAllocationsChange={(allocations) => 
                                          updateDayWorkItemAllocations(entry.id, date, allocations)
                                        }
                                      />
                                    )}
                                    
                                    {/* Narrative - only show after work items selected */}
                                    {(dayAllocations.length > 0 || !matterBudgetItems[entry.matterId]?.length) && (
                                      <Input
                                        placeholder="Brief notes for this day"
                                        value={entry.dayNarratives[dateKey] || ''}
                                        onChange={(e) => updateDayNarrative(entry.id, date, e.target.value)}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}

                {/* Non-Chargeable Section */}
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={mode === 'single' ? 3 : 4} className="font-semibold text-orange-600 dark:text-orange-400">
                    Non-Chargeable Activities
                  </TableCell>
                </TableRow>
                {gridEntries.filter(e => e.type === 'non-chargeable').map(entry => (
                  <TableRow key={entry.id} className={entry.hours > 0 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{entry.nonChargeableName}</div>
                        {entry.nonChargeableCode && (
                          <div className="text-sm text-muted-foreground">{entry.nonChargeableCode}</div>
                        )}
                        {entry.nonChargeableName === 'Other' && entry.hours > 0 && (
                          <Input
                            placeholder="Describe activity"
                            value={entry.otherDescription || ''}
                            onChange={(e) => updateEntry(entry.id, { otherDescription: e.target.value })}
                            className="mt-1 text-sm"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={entry.hours || ''}
                        onChange={(e) => updateEntry(entry.id, { hours: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-20 text-center"
                      />
                    </TableCell>
                    {mode === 'single' ? (
                      <TableCell>
                        <Input
                          placeholder="Brief notes - AI will polish"
                          value={entry.narrative}
                          onChange={(e) => updateEntry(entry.id, { narrative: e.target.value })}
                          disabled={entry.hours === 0}
                        />
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 justify-center">
                            {datesInRange.map(date => {
                              const dateKey = format(date, 'yyyy-MM-dd');
                              const isSelected = entry.selectedDays.some(d => format(d, 'yyyy-MM-dd') === dateKey);
                              return (
                                <div key={dateKey} className="flex flex-col items-center">
                                  <span className="text-[10px] text-muted-foreground mb-0.5">
                                    {format(date, 'EEE')}
                                  </span>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleDay(entry.id, date)}
                                    disabled={entry.hours === 0}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entry.selectedDays.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Select days first</span>
                          ) : (
                            <div className="space-y-2">
                              {entry.selectedDays.map(date => {
                                const dateKey = format(date, 'yyyy-MM-dd');
                                return (
                                  <div key={dateKey} className="flex items-center gap-2">
                                    <Badge variant="outline" className="shrink-0 text-xs">
                                      {format(date, 'EEE d')}
                                    </Badge>
                                    <Input
                                      placeholder="Brief notes for this day"
                                      value={entry.dayNarratives[dateKey] || ''}
                                      onChange={(e) => updateDayNarrative(entry.id, date, e.target.value)}
                                      className="flex-1"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons at bottom */}
      <div className="flex justify-between">
        <Button 
          variant="outline"
          onClick={handleSaveDraft}
          disabled={isSaving || getTotalHours() === 0}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </>
          )}
        </Button>
        <Button 
          onClick={processEntries} 
          disabled={isProcessing || getTotalHours() === 0}
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Process & Polish Narratives
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Render output
  const renderOutput = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Processed Output</h2>
          <p className="text-muted-foreground">Ready for your PA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={goBackToInput}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back & Edit
          </Button>
          <Button variant="outline" onClick={startOver}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button onClick={copyToClipboard}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy All
              </>
            )}
          </Button>
        </div>
      </div>

      {processedOutput?.map((day, dayIndex) => (
        <Card key={dayIndex}>
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {format(day.date, 'EEEE, d MMMM yyyy')}
            </CardTitle>
            <CardDescription>
              {day.entries.length} entries • {day.entries.reduce((s, e) => s + e.hours, 0).toFixed(2)} hours
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Client / Matter / Number</TableHead>
                  <TableHead className="w-[80px] text-center">Hours</TableHead>
                  <TableHead>Polished Narrative (editable)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {entry.type === 'matter' ? (
                        <div className="space-y-0.5">
                          <div className="font-semibold text-primary">{entry.clientName || 'Unknown Client'}</div>
                          <div className="font-medium">{entry.matterName || 'Unknown Matter'}</div>
                          <div className="text-sm text-muted-foreground">
                            {entry.cmNumber || 'N/A'}
                          </div>
                          {entry.workItemName && (
                            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              → {entry.workItemName}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-orange-600 dark:text-orange-400">
                            {entry.nonChargeableName}
                          </div>
                          {entry.nonChargeableCode && (
                            <div className="text-sm text-muted-foreground">{entry.nonChargeableCode}</div>
                          )}
                          {entry.otherDescription && (
                            <div className="text-sm text-muted-foreground">{entry.otherDescription}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">{entry.hours}</TableCell>
                    <TableCell>
                      <Textarea
                        value={entry.polishedNarrative || entry.narrative}
                        onChange={(e) => updatePolishedNarrative(dayIndex, entry.id, e.target.value)}
                        className="min-h-[80px] text-sm"
                        placeholder="Edit the polished narrative..."
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  if (mattersLoading) {
    return (
      <AppLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">Time Recording</h1>
          <p className="text-muted-foreground mt-1">
            Record your time with AI-enhanced narratives for your PA
          </p>
        </div>

        {step === 'mode-select' && renderModeSelect()}
        {step === 'grid-input' && renderGridInput()}
        {step === 'output' && renderOutput()}
      </div>
    </AppLayout>
  );
}
