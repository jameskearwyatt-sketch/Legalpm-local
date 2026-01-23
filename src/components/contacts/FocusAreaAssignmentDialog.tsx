import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Check, Plus, X } from "lucide-react";
import { useAnalyzeFocusAreas, useAssignFocusAreas } from "@/lib/hooks/useEmiFocusAreas";
import { toast } from "sonner";

interface FocusAreaAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  onComplete?: () => void;
}

type Step = 'analyze' | 'review' | 'protect-confirm' | 'assign' | 'done';

export function FocusAreaAssignmentDialog({
  open,
  onOpenChange,
  selectedContactIds,
  onComplete,
}: FocusAreaAssignmentDialogProps) {
  const [step, setStep] = useState<Step>('analyze');
  const [proposedFocusAreas, setProposedFocusAreas] = useState<string[]>([]);
  const [focusAreaDescriptions, setFocusAreaDescriptions] = useState<Record<string, string>>({});
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<Set<string>>(new Set());
  const [customFocusArea, setCustomFocusArea] = useState("");
  const [analysisDetails, setAnalysisDetails] = useState("");
  const [protectManualEdits, setProtectManualEdits] = useState(true);

  const analyzeMutation = useAnalyzeFocusAreas();
  const assignMutation = useAssignFocusAreas();

  const handleAnalyze = async () => {
    try {
      const result = await analyzeMutation.mutateAsync(
        selectedContactIds.length > 0 ? selectedContactIds : undefined
      );
      
      if (result.data) {
        setProposedFocusAreas(result.data.proposedFocusAreas || []);
        setFocusAreaDescriptions(result.focusAreaDescriptions || {});
        setAnalysisDetails(result.data.analysisDetails || "");
        // Pre-select all proposed focus areas
        setSelectedFocusAreas(new Set(result.data.proposedFocusAreas || []));
        setStep('review');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const handleAddCustom = () => {
    if (customFocusArea.trim() && !proposedFocusAreas.includes(customFocusArea.trim())) {
      const newArea = customFocusArea.trim();
      setProposedFocusAreas(prev => [...prev, newArea]);
      setSelectedFocusAreas(prev => new Set([...prev, newArea]));
      setCustomFocusArea("");
    }
  };

  const handleRemoveFocusArea = (area: string) => {
    setProposedFocusAreas(prev => prev.filter(a => a !== area));
    setSelectedFocusAreas(prev => {
      const newSet = new Set(prev);
      newSet.delete(area);
      return newSet;
    });
  };

  const toggleFocusArea = (area: string) => {
    setSelectedFocusAreas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(area)) {
        newSet.delete(area);
      } else {
        newSet.add(area);
      }
      return newSet;
    });
  };

  const handleProceedToAssign = () => {
    if (selectedFocusAreas.size === 0) {
      toast.error("Please select at least one focus area");
      return;
    }
    setStep('protect-confirm');
  };

  const handleAssign = async () => {
    setStep('assign');
    
    try {
      await assignMutation.mutateAsync({
        contactIds: selectedContactIds,
        focusAreas: Array.from(selectedFocusAreas),
        protectManualEdits,
      });
      setStep('done');
      onComplete?.();
    } catch (error) {
      setStep('review');
      console.error('Assignment failed:', error);
    }
  };

  const handleClose = () => {
    setStep('analyze');
    setProposedFocusAreas([]);
    setSelectedFocusAreas(new Set());
    setCustomFocusArea("");
    setAnalysisDetails("");
    setProtectManualEdits(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === 'analyze' && "Analyze EMI Focus Areas"}
            {step === 'review' && "Review & Approve Focus Areas"}
            {step === 'protect-confirm' && "Protect Manual Edits?"}
            {step === 'assign' && "Assigning Focus Areas..."}
            {step === 'done' && "Assignment Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === 'analyze' && `AI will analyze ${selectedContactIds.length > 0 ? selectedContactIds.length : 'all'} contact(s), their companies, NAICS codes, and your matter history to propose relevant EMI Focus Areas.`}
            {step === 'review' && "Review the proposed focus areas below. You can add, remove, or rename them before assigning to contacts."}
            {step === 'protect-confirm' && "Some contacts may have manually edited focus areas. Would you like to protect them from being overwritten?"}
            {step === 'assign' && "Please wait while focus areas are being assigned to contacts..."}
            {step === 'done' && "Focus areas have been successfully assigned to your contacts."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === 'analyze' && (
            <div className="py-8 text-center space-y-4">
              <div className="bg-muted/30 rounded-lg p-6 mx-auto max-w-md">
                <h3 className="font-medium mb-2">What the AI will analyze:</h3>
                <ul className="text-sm text-muted-foreground text-left space-y-1">
                  <li>• Contact NAICS industry codes</li>
                  <li>• Company names and web presence</li>
                  <li>• Matched clients from your matters</li>
                  <li>• Types of legal work you do for each client</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleAnalyze} 
                disabled={analyzeMutation.isPending}
                className="gap-2"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'review' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {analysisDetails && (
                  <div className="bg-muted/30 rounded-lg p-3 text-sm">
                    <p className="font-medium mb-1">AI Analysis:</p>
                    <p className="text-muted-foreground">{analysisDetails}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Proposed EMI Focus Areas</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Check the focus areas you want to use. Uncheck to exclude.
                  </p>
                  
                  <div className="space-y-2">
                    {proposedFocusAreas.map((area) => (
                      <div 
                        key={area} 
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30"
                      >
                        <Checkbox
                          checked={selectedFocusAreas.has(area)}
                          onCheckedChange={() => toggleFocusArea(area)}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{area}</span>
                          {focusAreaDescriptions[area] && (
                            <p className="text-xs text-muted-foreground">
                              {focusAreaDescriptions[area]}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveFocusArea(area)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm font-medium">Add Custom Focus Area</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="e.g., Hydrogen, BESS, Carbon Capture..."
                      value={customFocusArea}
                      onChange={(e) => setCustomFocusArea(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                    />
                    <Button 
                      variant="outline" 
                      onClick={handleAddCustom}
                      disabled={!customFocusArea.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                  <p className="text-sm">
                    <strong>{selectedFocusAreas.size}</strong> focus area{selectedFocusAreas.size !== 1 ? 's' : ''} selected. 
                    These will be used to categorize <strong>{selectedContactIds.length > 0 ? selectedContactIds.length : 'all'}</strong> contact{selectedContactIds.length !== 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </ScrollArea>
          )}

          {step === 'protect-confirm' && (
            <div className="py-6 space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">Manual Edits Detected</h4>
                <p className="text-sm text-muted-foreground">
                  Some contacts in your selection have had their EMI Focus Areas manually edited. 
                  You can choose to protect these edits from being overwritten by the AI assignment.
                </p>
              </div>
              
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Checkbox 
                  id="protect-edits" 
                  checked={protectManualEdits}
                  onCheckedChange={(checked) => setProtectManualEdits(checked === true)}
                />
                <div>
                  <Label htmlFor="protect-edits" className="font-medium cursor-pointer">
                    Protect previous manual edits
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Contacts with manually edited focus areas will be skipped during this assignment.
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">
                  {protectManualEdits 
                    ? "✓ Manual edits will be preserved. Only contacts without manual edits will be updated."
                    : "⚠️ All contacts will be updated, including those with manual edits."}
                </p>
              </div>
            </div>
          )}

          {step === 'assign' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">
                Assigning focus areas to {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''}...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take a moment as AI analyzes each contact.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium">Focus Areas Assigned Successfully!</p>
              <p className="text-sm text-muted-foreground">
                {assignMutation.data?.updated || 0} contact{(assignMutation.data?.updated || 0) !== 1 ? 's' : ''} updated.
                {assignMutation.data?.skipped && assignMutation.data.skipped > 0 && (
                  <span className="block mt-1">
                    {assignMutation.data.skipped} contact{assignMutation.data.skipped !== 1 ? 's' : ''} skipped (manual edits protected).
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleProceedToAssign}
                disabled={selectedFocusAreas.size === 0}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Continue
              </Button>
            </>
          )}
          {step === 'protect-confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('review')}>
                Back
              </Button>
              <Button onClick={handleAssign} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Assign to Contacts
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
