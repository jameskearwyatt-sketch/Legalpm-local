import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCloudComputeLearnings } from '@/lib/hooks/useCloudComputeLearnings';
import { CloudComputeExtractedPosition } from '@/lib/hooks/useCloudComputeAnalyses';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; position: CloudComputeExtractedPosition; analysisId: string; projectName: string; onPositionUpdated?: (ns: string, nv?: string) => void; }

export function CloudComputeTeachFeedbackDialog({ open, onOpenChange, position, analysisId, projectName, onPositionUpdated }: Props) {
  const [feedback, setFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctedPosition, setCorrectedPosition] = useState<string | null>(null);
  const { createLearning } = useCloudComputeLearnings();

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) { toast.error('Please provide feedback'); return; }
    setIsProcessing(true);
    try {
      const corrected = `[User correction] ${feedback}\n\nOriginal: ${position.position_summary}`;
      await createLearning.mutateAsync({ user_id: '', category: position.category, original_position: position.position_summary, corrected_position: corrected, correction_reason: feedback, analysis_id: analysisId, is_active: true });
      setCorrectedPosition(corrected);
      const { error: ue } = await supabase.from('cloud_compute_extracted_positions').update({ position_summary: corrected } as any).eq('id', position.id);
      if (!ue && onPositionUpdated) onPositionUpdated(corrected);
      toast.success('Learning saved!');
    } catch (e) { console.error(e); toast.error('Failed to process feedback.'); } finally { setIsProcessing(false); }
  };

  const handleClose = () => { setFeedback(''); setCorrectedPosition(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Teach AI - {position.category}</DialogTitle><DialogDescription>Provide feedback for future cloud compute analyses.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2"><Label>Current Analysis</Label><div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line">{position.position_summary}</div></div>
          <div className="space-y-2"><Label htmlFor="feedback">Your Correction</Label><Textarea id="feedback" placeholder="e.g., 'The SLA is actually 99.99%, not 99.9%...'" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} disabled={isProcessing || !!correctedPosition} /></div>
          {correctedPosition && <div className="space-y-2"><Label className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Learning Saved</Label><Badge variant="secondary" className="text-xs">✓ AI will remember this</Badge></div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={handleClose}>{correctedPosition ? 'Done' : 'Cancel'}</Button>{!correctedPosition && <Button onClick={handleSubmitFeedback} disabled={isProcessing || !feedback.trim()}>{isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Send className="h-4 w-4 mr-2" /> Submit</>}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
