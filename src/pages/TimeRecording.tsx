import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays, eachDayOfInterval } from 'date-fns';
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
import { 
  CalendarIcon, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  Loader2,
  FileText,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
}

interface DayOutputEntry {
  id: string;
  type: 'matter' | 'non-chargeable';
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
}

interface DayOutput {
  date: Date;
  entries: DayOutputEntry[];
}

type Step = 'mode-select' | 'grid-input' | 'output';

export default function TimeRecording() {
  const { toast } = useToast();
  const { matters, isLoading: mattersLoading } = useMatters();
  
  // Step state
  const [step, setStep] = useState<Step>('mode-select');
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  
  // Date state
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Grid entries - one row per matter/non-chargeable
  const [gridEntries, setGridEntries] = useState<GridRowEntry[]>([]);
  
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
        clientName: matter.clients?.name,
        cmNumber: matter.cm_number || undefined,
        hours: 0,
        narrative: '',
        selectedDays: [],
        dayNarratives: {},
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
      });
    });
    
    setGridEntries(entries);
  };

  const selectMode = (selectedMode: 'single' | 'multi') => {
    setMode(selectedMode);
    initializeGrid();
    setStep('grid-input');
    setProcessedOutput(null);
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
        delete newDayNarratives[dateKey];
        return { ...entry, selectedDays: newSelectedDays, dayNarratives: newDayNarratives };
      } else {
        // Add day
        return { 
          ...entry, 
          selectedDays: [...entry.selectedDays, date].sort((a, b) => a.getTime() - b.getTime()),
          dayNarratives: { ...entry.dayNarratives, [dateKey]: '' }
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

  // Intelligent time spreading - uses iterative distribution
  const spreadTimeAcrossDays = (totalHours: number, dayCount: number): number[] => {
    if (dayCount === 0) return [];
    if (dayCount === 1) return [totalHours];
    
    // Use a slight wave pattern for natural distribution
    const baseHours = totalHours / dayCount;
    const result: number[] = [];
    let remaining = totalHours;
    
    for (let i = 0; i < dayCount; i++) {
      if (i === dayCount - 1) {
        // Last day gets remaining to avoid rounding issues
        result.push(Math.round(remaining * 4) / 4); // Round to 0.25
      } else {
        // Slight variation: alternate between slightly more/less
        const variation = (i % 2 === 0) ? 1.05 : 0.95;
        const hours = Math.round(baseHours * variation * 4) / 4;
        result.push(hours);
        remaining -= hours;
      }
    }
    
    return result;
  };

  const processEntries = async () => {
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
        const polishedEntries = await Promise.all(
          activeEntries.map(async (entry) => ({
            id: entry.id,
            type: entry.type,
            matterNumber: entry.matterNumber,
            matterName: entry.matterName,
            clientName: entry.clientName,
            cmNumber: entry.cmNumber,
            nonChargeableCode: entry.nonChargeableCode,
            nonChargeableName: entry.nonChargeableName,
            otherDescription: entry.otherDescription,
            hours: entry.hours,
            narrative: entry.narrative,
            polishedNarrative: await polishNarrative(entry.narrative),
          }))
        );

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
            
            outputMap[dateKey].push({
              id: `${entry.id}-${dateKey}`,
              type: entry.type,
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
            });
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

      for (const entry of day.entries) {
        if (entry.type === 'matter') {
          output += `CLIENT: ${entry.clientName || 'N/A'}\n`;
          output += `MATTER: ${entry.matterName || 'N/A'}\n`;
          output += `MATTER NUMBER: ${entry.cmNumber || 'N/A'}\n`;
        } else {
          const code = entry.nonChargeableCode ? ` (${entry.nonChargeableCode})` : '';
          output += `NON-CHARGEABLE: ${entry.nonChargeableName}${code}\n`;
          if (entry.otherDescription) {
            output += `Description: ${entry.otherDescription}\n`;
          }
        }
        output += `TIME: ${entry.hours} hours\n`;
        output += `NARRATIVE:\n${entry.polishedNarrative || entry.narrative}\n`;
        output += `───────────────────────────────────────────────────────────────\n\n`;
      }
    }

    return output;
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
    const text = formatOutputForClipboard();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Time recording output copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const startOver = () => {
    setStep('mode-select');
    setMode(null);
    setGridEntries([]);
    setProcessedOutput(null);
    setDateRange({ from: undefined, to: undefined });
  };

  const getTotalHours = () => gridEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Render mode selection
  const renderModeSelect = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
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

      {/* Total hours summary */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Total Hours:</span>
          <span className="text-2xl font-bold">{getTotalHours().toFixed(2)}</span>
        </div>
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

      {/* Process button at bottom */}
      <div className="flex justify-end">
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
          <Button variant="outline" onClick={startOver}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
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
