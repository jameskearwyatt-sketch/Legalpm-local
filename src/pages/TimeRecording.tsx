import { useState, useMemo } from 'react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMatters } from '@/lib/hooks/useMatters';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CalendarIcon, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  Plus, 
  Trash2,
  Loader2,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface TimeEntry {
  id: string;
  type: 'matter' | 'non-chargeable';
  matterId?: string;
  matterNumber?: string;
  matterName?: string;
  nonChargeableCode?: string;
  nonChargeableName?: string;
  otherDescription?: string;
  hours: number;
  narrative: string;
  polishedNarrative?: string;
}

interface DayOutput {
  date: Date;
  entries: TimeEntry[];
}

export default function TimeRecording() {
  const { toast } = useToast();
  const { matters, isLoading: mattersLoading } = useMatters();
  
  // Mode
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  
  // Single day state
  const [singleDate, setSingleDate] = useState<Date>(new Date());
  const [singleEntries, setSingleEntries] = useState<TimeEntry[]>([]);
  
  // Multi day state
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [multiEntries, setMultiEntries] = useState<TimeEntry[]>([]);
  const [spreadEqually, setSpreadEqually] = useState(true);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedOutput, setProcessedOutput] = useState<DayOutput[] | null>(null);
  const [copied, setCopied] = useState(false);

  // Filter only live matters
  const liveMatters = useMemo(() => 
    matters?.filter(m => m.category === 'Live') || [], 
    [matters]
  );

  const addEntry = (entries: TimeEntry[], setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>) => {
    setEntries([...entries, {
      id: crypto.randomUUID(),
      type: 'matter',
      hours: 0,
      narrative: '',
    }]);
  };

  const removeEntry = (entries: TimeEntry[], setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>, id: string) => {
    setEntries(entries.filter(e => e.id !== id));
  };

  const updateEntry = (
    entries: TimeEntry[], 
    setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>, 
    id: string, 
    updates: Partial<TimeEntry>
  ) => {
    setEntries(entries.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const polishNarrative = async (narrative: string): Promise<string> => {
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

  const processEntries = async () => {
    setIsProcessing(true);
    
    try {
      const entriesToProcess = mode === 'single' ? singleEntries : multiEntries;
      
      if (entriesToProcess.length === 0) {
        toast({
          title: "No entries",
          description: "Please add at least one time entry before processing.",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      // Polish all narratives
      const polishedEntries = await Promise.all(
        entriesToProcess.map(async (entry) => ({
          ...entry,
          polishedNarrative: entry.narrative ? await polishNarrative(entry.narrative) : '',
        }))
      );

      if (mode === 'single') {
        setProcessedOutput([{
          date: singleDate,
          entries: polishedEntries,
        }]);
      } else {
        // Multi-day processing
        if (!dateRange.from || !dateRange.to) {
          toast({
            title: "Select dates",
            description: "Please select a date range for multi-day mode.",
            variant: "destructive"
          });
          setIsProcessing(false);
          return;
        }

        const dayCount = differenceInDays(dateRange.to, dateRange.from) + 1;
        const outputs: DayOutput[] = [];

        if (spreadEqually) {
          // Spread time equally across all days
          for (let i = 0; i < dayCount; i++) {
            const date = addDays(dateRange.from, i);
            outputs.push({
              date,
              entries: polishedEntries.map(entry => ({
                ...entry,
                hours: Number((entry.hours / dayCount).toFixed(2)),
              })),
            });
          }
        } else {
          // All time on first day (user can adjust manually)
          outputs.push({
            date: dateRange.from,
            entries: polishedEntries,
          });
          
          // Add empty days for remaining
          for (let i = 1; i < dayCount; i++) {
            outputs.push({
              date: addDays(dateRange.from, i),
              entries: [],
            });
          }
        }

        setProcessedOutput(outputs);
      }

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
          output += `MATTER: ${entry.matterNumber || 'N/A'} - ${entry.matterName || 'N/A'}\n`;
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

  const renderEntryForm = (
    entries: TimeEntry[], 
    setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>
  ) => (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <Card key={entry.id} className="relative">
          <CardContent className="pt-4">
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeEntry(entries, setEntries, entry.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            
            <div className="grid gap-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label>Entry Type</Label>
                <Select
                  value={entry.type}
                  onValueChange={(value: 'matter' | 'non-chargeable') => 
                    updateEntry(entries, setEntries, entry.id, { 
                      type: value,
                      matterId: undefined,
                      matterNumber: undefined,
                      matterName: undefined,
                      nonChargeableCode: undefined,
                      nonChargeableName: undefined,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matter">Chargeable Matter</SelectItem>
                    <SelectItem value="non-chargeable">Non-Chargeable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Matter or Non-chargeable selector */}
              {entry.type === 'matter' ? (
                <div className="space-y-2">
                  <Label>Matter</Label>
                  <Select
                    value={entry.matterId}
                    onValueChange={(value) => {
                      const matter = liveMatters.find(m => m.id === value);
                      updateEntry(entries, setEntries, entry.id, {
                        matterId: value,
                        matterNumber: matter?.matter_number,
                        matterName: matter?.matter_name,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a matter" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveMatters.map((matter) => (
                        <SelectItem key={matter.id} value={matter.id}>
                          {matter.matter_number} - {matter.matter_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Non-Chargeable Category</Label>
                  <Select
                    value={entry.nonChargeableName}
                    onValueChange={(value) => {
                      const nc = NON_CHARGEABLE_CODES.find(c => c.name === value);
                      updateEntry(entries, setEntries, entry.id, {
                        nonChargeableCode: nc?.code,
                        nonChargeableName: value,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {NON_CHARGEABLE_CODES.map((nc) => (
                        <SelectItem key={nc.name} value={nc.name}>
                          {nc.name}{nc.code && ` (${nc.code})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {entry.nonChargeableName === 'Other' && (
                    <div className="mt-2">
                      <Label>Description</Label>
                      <Input
                        placeholder="Describe the activity"
                        value={entry.otherDescription || ''}
                        onChange={(e) => updateEntry(entries, setEntries, entry.id, {
                          otherDescription: e.target.value,
                        })}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Hours */}
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={entry.hours || ''}
                  onChange={(e) => updateEntry(entries, setEntries, entry.id, {
                    hours: parseFloat(e.target.value) || 0,
                  })}
                  placeholder="0.0"
                />
              </div>

              {/* Narrative */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Narrative
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI will polish
                  </Badge>
                </Label>
                <Textarea
                  placeholder="Brief notes - AI will expand into professional narrative"
                  value={entry.narrative}
                  onChange={(e) => updateEntry(entries, setEntries, entry.id, {
                    narrative: e.target.value,
                  })}
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => addEntry(entries, setEntries)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Time Entry
      </Button>
    </div>
  );

  const getTotalHours = (entries: TimeEntry[]) => 
    entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground">Time Recording</h1>
          <p className="text-muted-foreground mt-1">
            Record your time with AI-enhanced narratives for your PA
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'multi')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Single Day
            </TabsTrigger>
            <TabsTrigger value="multi" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Multi-Day
            </TabsTrigger>
          </TabsList>

          {/* Single Day Mode */}
          <TabsContent value="single" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Select Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
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
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Time Entries</h2>
              <Badge variant="outline" className="text-base">
                <Clock className="h-4 w-4 mr-1" />
                {getTotalHours(singleEntries)} hours
              </Badge>
            </div>

            {renderEntryForm(singleEntries, setSingleEntries)}
          </TabsContent>

          {/* Multi-Day Mode */}
          <TabsContent value="multi" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Select Date Range
                </CardTitle>
                <CardDescription>
                  Choose the days you want to record time for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "d MMM")} - {format(dateRange.to, "d MMM yyyy")}
                          </>
                        ) : (
                          format(dateRange.from, "d MMMM yyyy")
                        )
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={(range) => {
                        if (range) {
                          setDateRange({ from: range.from, to: range.to });
                        } else {
                          setDateRange({ from: undefined, to: undefined });
                        }
                      }}
                      numberOfMonths={2}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                {dateRange.from && dateRange.to && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">
                      {differenceInDays(dateRange.to, dateRange.from) + 1} days selected
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time Distribution</CardTitle>
                <CardDescription>
                  How should your time be spread across the selected days?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Spread time equally</Label>
                    <p className="text-sm text-muted-foreground">
                      Divide hours evenly across all selected days
                    </p>
                  </div>
                  <Switch
                    checked={spreadEqually}
                    onCheckedChange={setSpreadEqually}
                  />
                </div>
                {!spreadEqually && (
                  <p className="text-sm text-amber-600 mt-3">
                    All time will be assigned to the first day. You can adjust manually after processing.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Total Time Entries</h2>
              <Badge variant="outline" className="text-base">
                <Clock className="h-4 w-4 mr-1" />
                {getTotalHours(multiEntries)} hours total
              </Badge>
            </div>

            {renderEntryForm(multiEntries, setMultiEntries)}
          </TabsContent>
        </Tabs>

        {/* Process Button */}
        <div className="mt-8">
          <Button
            size="lg"
            className="w-full"
            onClick={processEntries}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing & Polishing Narratives...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Process Time Recording
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        {processedOutput && (
          <div className="mt-8 space-y-6">
            <Separator />
            
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Processed Output</h2>
              <Button
                onClick={copyToClipboard}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-4">
              {processedOutput.map((day, dayIndex) => (
                <Card key={dayIndex}>
                  <CardHeader className="bg-muted/50">
                    <CardTitle className="text-lg">
                      {format(day.date, 'EEEE, d MMMM yyyy')}
                    </CardTitle>
                    <CardDescription>
                      {day.entries.length} entries • {getTotalHours(day.entries)} hours
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y">
                    {day.entries.length === 0 ? (
                      <p className="py-4 text-muted-foreground text-center">
                        No time recorded for this day
                      </p>
                    ) : (
                      day.entries.map((entry, entryIndex) => (
                        <div key={entryIndex} className="py-4 first:pt-4 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant={entry.type === 'matter' ? 'default' : 'secondary'}>
                                  {entry.type === 'matter' ? 'Chargeable' : 'Non-Chargeable'}
                                </Badge>
                                <span className="font-medium">
                                  {entry.type === 'matter' 
                                    ? `${entry.matterNumber} - ${entry.matterName}`
                                    : entry.nonChargeableName}
                                </span>
                                {entry.nonChargeableCode && (
                                  <Badge variant="outline">{entry.nonChargeableCode}</Badge>
                                )}
                              </div>
                              {entry.otherDescription && (
                                <p className="text-sm text-muted-foreground">
                                  {entry.otherDescription}
                                </p>
                              )}
                              <div className="bg-muted/50 p-3 rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground mb-1">
                                  Polished Narrative:
                                </p>
                                <p className="text-sm">{entry.polishedNarrative}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              {entry.hours}h
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
