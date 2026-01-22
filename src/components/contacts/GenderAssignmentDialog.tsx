import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Contact {
  id: string;
  full_name: string;
  gender: string;
}

interface GenderResult {
  id: string;
  full_name: string;
  inferred_gender: 'male' | 'female' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

interface EditableResult extends GenderResult {
  selected: boolean;
  edited_gender: 'male' | 'female' | 'unknown';
}

interface GenderAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
}

export function GenderAssignmentDialog({ open, onOpenChange, contacts }: GenderAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<'idle' | 'analyzing' | 'review' | 'saving'>('idle');
  const [results, setResults] = useState<EditableResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const unknownContacts = useMemo(() => 
    contacts.filter(c => c.gender === 'unknown'),
    [contacts]
  );

  const selectedCount = useMemo(() => 
    results.filter(r => r.selected).length,
    [results]
  );

  const handleAnalyze = async () => {
    setStage('analyzing');
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('infer-genders', {
        body: { 
          contacts: unknownContacts.map(c => ({ id: c.id, full_name: c.full_name }))
        }
      });

      if (fnError) throw new Error(fnError.message);
      if (!data.success) throw new Error(data.error || 'Analysis failed');

      // Convert to editable results, pre-selecting high-confidence non-unknown results
      const editableResults: EditableResult[] = data.results.map((r: GenderResult) => ({
        ...r,
        selected: r.inferred_gender !== 'unknown' && r.confidence !== 'low',
        edited_gender: r.inferred_gender,
      }));

      setResults(editableResults);
      setStage('review');
    } catch (err) {
      console.error('Gender analysis error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze names');
      setStage('idle');
    }
  };

  const handleToggleSelect = (id: string) => {
    setResults(prev => prev.map(r => 
      r.id === id ? { ...r, selected: !r.selected } : r
    ));
  };

  const handleChangeGender = (id: string, gender: 'male' | 'female' | 'unknown') => {
    setResults(prev => prev.map(r => 
      r.id === id ? { ...r, edited_gender: gender, selected: gender !== 'unknown' } : r
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    setResults(prev => prev.map(r => ({
      ...r,
      selected: checked && r.edited_gender !== 'unknown'
    })));
  };

  const handleSave = async () => {
    const toSave = results.filter(r => r.selected && r.edited_gender !== 'unknown');
    if (toSave.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setStage('saving');

    try {
      let saved = 0;
      for (const result of toSave) {
        const { error } = await supabase
          .from('distribution_contacts')
          .update({ gender: result.edited_gender })
          .eq('id', result.id);

        if (!error) saved++;
      }

      queryClient.invalidateQueries({ queryKey: ['distribution-contacts'] });
      toast.success(`Updated gender for ${saved} contact${saved !== 1 ? 's' : ''}`);
      onOpenChange(false);
      setStage('idle');
      setResults([]);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save some updates');
      setStage('review');
    }
  };

  const handleClose = () => {
    if (stage === 'analyzing' || stage === 'saving') return;
    onOpenChange(false);
    setStage('idle');
    setResults([]);
    setError(null);
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Medium</Badge>;
      case 'low':
        return <Badge variant="default" className="bg-red-500/20 text-red-700 border-red-500/30">Low</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Gender Assignment
          </DialogTitle>
          <DialogDescription>
            {stage === 'idle' && `Analyze ${unknownContacts.length} contacts with unknown gender using AI.`}
            {stage === 'analyzing' && 'Analyzing names with cultural context awareness...'}
            {stage === 'review' && 'Review and correct the AI suggestions before saving.'}
            {stage === 'saving' && 'Saving your selections...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {stage === 'idle' && (
            <div className="py-8 text-center space-y-4">
              {error && (
                <div className="flex items-center justify-center gap-2 text-destructive mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
              <p className="text-muted-foreground">
                The AI will analyze {unknownContacts.length} names, considering cultural origins and name patterns
                to infer likely genders with confidence levels.
              </p>
              <p className="text-sm text-muted-foreground">
                You'll be able to review and correct all suggestions before saving.
              </p>
            </div>
          )}

          {stage === 'analyzing' && (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analysing {unknownContacts.length} names...</p>
              <p className="text-xs text-muted-foreground">This may take a moment</p>
            </div>
          )}

          {stage === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {results.length} selected for update
                </span>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={selectedCount === results.filter(r => r.edited_gender !== 'unknown').length && selectedCount > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm">Select all valid</span>
                </div>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>AI Suggestion</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="w-[140px]">Final Gender</TableHead>
                      <TableHead>Reasoning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow 
                        key={result.id}
                        className={result.edited_gender === 'unknown' ? 'opacity-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={result.selected}
                            onCheckedChange={() => handleToggleSelect(result.id)}
                            disabled={result.edited_gender === 'unknown'}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{result.full_name}</TableCell>
                        <TableCell>
                          <span className="capitalize">{result.inferred_gender}</span>
                          {result.inferred_gender !== result.edited_gender && (
                            <span className="text-xs text-muted-foreground ml-1">(changed)</span>
                          )}
                        </TableCell>
                        <TableCell>{getConfidenceBadge(result.confidence)}</TableCell>
                        <TableCell>
                          <Select
                            value={result.edited_gender}
                            onValueChange={(v) => handleChangeGender(result.id, v as 'male' | 'female' | 'unknown')}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          {result.reasoning ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="truncate block cursor-help">{result.reasoning}</span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <p>{result.reasoning}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  High confidence = auto-selected
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 text-yellow-500" />
                  Low confidence = review carefully
                </span>
              </div>
            </div>
          )}

          {stage === 'saving' && (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Saving {selectedCount} updates...</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {stage === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleAnalyze} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Analyse with AI
              </Button>
            </>
          )}

          {stage === 'review' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={selectedCount === 0} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Save {selectedCount} Update{selectedCount !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
