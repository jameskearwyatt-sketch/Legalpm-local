import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';
import { ITSupplyExtractedPosition } from '@/lib/hooks/useITSupplyAnalyses';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; position: ITSupplyExtractedPosition; analysisId: string; projectName: string; onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void; }

export function ITSupplyTeachFeedbackDialog({ open, onOpenChange, position, analysisId, projectName, onPositionUpdated }: Props) {
  const [feedback, setFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctedPosition, setCorrectedPosition] = useState<string | null>(null);
  const { createLearning } = useITSupplyLearnings();

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) { toast.error('Please provide feedback'); return; }
    setIsProcessing(true);
    try {
      const corrected = `[User correction] ${feedback}\n\nOriginal: ${position.position_summary}`;
      await createLearning.mutateAsync({ user_id: '', category: position.category, original_position: position.position_summary, corrected_position: corrected, correction_reason: feedback, analysis_id: analysisId, is_active: true });
      setCorrectedPosition(corrected);
      const { error: ue } = await supabase.from('it_supply_extracted_positions').update({ position_summary: corrected } as any).eq('id', position.id);
      if (!ue && onPositionUpdated) onPositionUpdated(corrected);
      toast.success('Learning saved! AI will remember this correction.');
    } catch (error) { console.error(error); toast.error('Failed to process feedback.'); } finally { setIsProcessing(false); }
  };

  const handleClose = () => { setFeedback(''); setCorrectedPosition(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Teach AI - {position.category}</DialogTitle><DialogDescription>Provide feedback to correct this analysis. The AI will remember this for future IT supply analyses.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label className="text-sm font-medium">Current Analysis</Label><div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line">{position.position_summary}</div></div>
          <div className="space-y-2"><Label htmlFor="feedback" className="text-sm font-medium">Your Correction / Feedback</Label><Textarea id="feedback" placeholder="e.g., 'The allocation priority is actually P1, not P2...'" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} disabled={isProcessing || !!correctedPosition} /><p className="text-xs text-muted-foreground">Be specific about what the AI got wrong.</p></div>
          {correctedPosition && <div className="space-y-2"><Label className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Learning Saved</Label><Badge variant="secondary" className="text-xs">✓ AI will remember this for future analyses</Badge></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={handleClose}>{correctedPosition ? 'Done' : 'Cancel'}</Button>{!correctedPosition && <Button onClick={handleSubmitFeedback} disabled={isProcessing || !feedback.trim()}>{isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Send className="h-4 w-4 mr-2" /> Submit Correction</>}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
