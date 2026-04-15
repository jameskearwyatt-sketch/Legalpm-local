import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Lightbulb, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LearningConflictWarning } from '@/components/shared/LearningConflictWarning';
import type { AnalystType } from '@/lib/analyst/semanticRetrieval';
import type { BaseAnalystLearning, LearningsHookResult } from '@/lib/analyst/createLearningsHook';

/**
 * Structured feedback tags — mirror the CHECK constraint on the
 * *_learnings.feedback_type column (migration 20260420000001).
 */
export type FeedbackType =
  | 'wrong_category'
  | 'wrong_summary'
  | 'wrong_market_assessment'
  | 'missing_context'
  | 'wrong_confidence'
  | 'other';

const FEEDBACK_TYPE_OPTIONS: { value: FeedbackType; label: string; description: string }[] = [
  { value: 'wrong_category',          label: 'Wrong category',          description: 'Position was mis-categorised' },
  { value: 'wrong_summary',           label: 'Wrong summary',           description: 'Summary misrepresents the clause' },
  { value: 'wrong_market_assessment', label: 'Wrong market assessment', description: 'Market-position / favorability is off' },
  { value: 'missing_context',         label: 'Missing context',         description: 'Correct but incomplete' },
  { value: 'wrong_confidence',        label: 'Wrong confidence',        description: 'Confidence level is over/understated' },
  { value: 'other',                   label: 'Other',                   description: 'Doesn\'t fit the above categories' },
];

export interface TeachFeedbackPosition {
  id: string;
  category: string;
  position_summary: string;
  source_text?: string | null;
}

interface AnalystTeachFeedbackDialogProps<T extends BaseAnalystLearning> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: TeachFeedbackPosition;
  analysisId: string;
  /** Analyst type for LearningConflictWarning + provenance. */
  analyst: AnalystType;
  /** Supabase table for extracted positions (e.g. 'tolling_extracted_positions'). */
  positionsTableName: string;
  /** Human-readable descriptor, e.g. "tolling" or "cloud compute". */
  analystLabel: string;
  /** Placeholder text for the feedback textarea. */
  placeholder: string;
  /** Already-invoked learnings hook for this analyst. */
  learningsHook: LearningsHookResult<T>;
  onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void;
}

/**
 * Shared Teach AI feedback dialog used by the 4 simple analyst tools
 * (Tolling, Carbon, IT Supply, Cloud Compute). Saves a learning via the
 * caller's learnings hook and updates the extracted position's summary
 * inline so the user immediately sees their correction.
 */
export function AnalystTeachFeedbackDialog<T extends BaseAnalystLearning>({
  open, onOpenChange, position, analysisId, analyst, positionsTableName,
  analystLabel, placeholder, learningsHook, onPositionUpdated,
}: AnalystTeachFeedbackDialogProps<T>) {
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctedPosition, setCorrectedPosition] = useState<string | null>(null);
  const { createLearning } = learningsHook;

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      toast.error('Please provide feedback');
      return;
    }

    setIsProcessing(true);
    try {
      const corrected = `[User correction] ${feedback}\n\nOriginal: ${position.position_summary}`;

      await createLearning.mutateAsync({
        user_id: '',
        category: position.category,
        original_position: position.position_summary,
        corrected_position: corrected,
        correction_reason: feedback,
        analysis_id: analysisId,
        is_active: true,
        ...(feedbackType ? { feedback_type: feedbackType } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      setCorrectedPosition(corrected);

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from(positionsTableName as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ position_summary: corrected } as any)
        .eq('id', position.id);

      if (!updateError && onPositionUpdated) onPositionUpdated(corrected);
      toast.success('Learning saved! AI will remember this correction.');
    } catch (error) {
      console.error('Error processing feedback:', error);
      toast.error('Failed to process feedback.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setFeedback('');
    setFeedbackType('');
    setCorrectedPosition(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Teach AI - {position.category}
          </DialogTitle>
          <DialogDescription>
            Provide feedback to correct this analysis. The AI will remember this for future {analystLabel} analyses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Current Analysis</Label>
            <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line">
              {position.position_summary}
            </div>
            {position.source_text && (
              <div className="text-xs text-muted-foreground">Source: {position.source_text}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-type" className="text-sm font-medium">
              What kind of mistake? <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select
              value={feedbackType}
              onValueChange={(v) => setFeedbackType(v as FeedbackType)}
              disabled={isProcessing || !!correctedPosition}
            >
              <SelectTrigger id="feedback-type">
                <SelectValue placeholder="Select a category so we can aggregate error modes..." />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="text-sm">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback" className="text-sm font-medium">Your Correction / Feedback</Label>
            <Textarea
              id="feedback"
              placeholder={placeholder}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              disabled={isProcessing || !!correctedPosition}
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what the AI got wrong and what the correct interpretation should be.
            </p>
            {!correctedPosition && (
              <LearningConflictWarning analyst={analyst} category={position.category} text={feedback} />
            )}
          </div>

          {correctedPosition && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Learning Saved
              </Label>
              <Badge variant="secondary" className="text-xs">
                ✓ AI will remember this for future analyses in "{position.category}"
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {correctedPosition ? 'Done' : 'Cancel'}
          </Button>
          {!correctedPosition && (
            <Button onClick={handleSubmitFeedback} disabled={isProcessing || !feedback.trim()}>
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Submit Correction</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
