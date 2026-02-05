 import { useState } from 'react';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { Loader2, Lightbulb, Send, Sparkles } from 'lucide-react';
 import { toast } from 'sonner';
 import { supabase } from '@/integrations/supabase/client';
 import { usePPALearnings } from '@/lib/hooks/usePPALearnings';
 import { PPAExtractedPosition } from '@/lib/hooks/usePPAAnalyses';
 
 interface PPATeachFeedbackDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   position: PPAExtractedPosition;
   analysisId: string;
   projectName: string;
   jurisdiction: string | null;
   ppaType: string | null;
   onPositionUpdated?: (newSummary: string) => void;
 }
 
 export function PPATeachFeedbackDialog({
   open,
   onOpenChange,
   position,
   analysisId,
   projectName,
   jurisdiction,
   ppaType,
   onPositionUpdated,
 }: PPATeachFeedbackDialogProps) {
   const [feedback, setFeedback] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const [correctedPosition, setCorrectedPosition] = useState<string | null>(null);
   const { createLearning } = usePPALearnings();
 
   const handleSubmitFeedback = async () => {
     if (!feedback.trim()) {
       toast.error('Please provide feedback');
       return;
     }
 
     setIsProcessing(true);
     try {
       // Call edge function to process feedback and reanalyze
       const { data, error } = await supabase.functions.invoke('process-ppa-feedback', {
         body: {
           positionId: position.id,
           category: position.category,
           originalPosition: position.position_summary,
           userFeedback: feedback,
           sourceText: position.source_text,
           projectName,
           jurisdiction,
           ppaType,
         },
       });
 
       if (error) throw error;
 
       const newPosition = data.corrected_position;
       setCorrectedPosition(newPosition);
 
       // Save the learning to the database
       await createLearning.mutateAsync({
         user_id: '', // Will be set by the hook
         category: position.category,
         original_position: position.position_summary,
         user_feedback: feedback,
         corrected_position: newPosition,
         source_analysis_id: analysisId,
         source_position_id: position.id,
         project_context: projectName,
         jurisdiction,
         ppa_type: ppaType,
         is_active: true,
       });
 
       // Update the position in the database
       const { error: updateError } = await supabase
         .from('ppa_extracted_positions')
         .update({ position_summary: newPosition })
         .eq('id', position.id);
 
       if (updateError) {
         console.error('Failed to update position:', updateError);
       } else if (onPositionUpdated) {
         onPositionUpdated(newPosition);
       }
 
       toast.success('Position reanalyzed and learning saved!');
     } catch (error) {
       console.error('Error processing feedback:', error);
       toast.error('Failed to process feedback. Please try again.');
     } finally {
       setIsProcessing(false);
     }
   };
 
   const handleClose = () => {
     setFeedback('');
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
             Provide feedback to correct this analysis. The AI will reanalyze and remember this correction for future analyses.
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Current Position */}
           <div className="space-y-2">
             <Label className="text-sm font-medium">Current Analysis</Label>
             <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line">
               {position.position_summary}
             </div>
             {position.source_text && (
               <div className="text-xs text-muted-foreground">
                 Source: {position.source_text}
               </div>
             )}
           </div>
 
           {/* Feedback Input */}
           <div className="space-y-2">
             <Label htmlFor="feedback" className="text-sm font-medium">
               Your Correction / Feedback
             </Label>
             <Textarea
               id="feedback"
               placeholder="e.g., 'This document DOES have a curtailment provision - see Clause 12.3. The AI missed that voluntary curtailment is addressed under the Dispatch Rights section...'"
               value={feedback}
               onChange={(e) => setFeedback(e.target.value)}
               rows={4}
               disabled={isProcessing || !!correctedPosition}
             />
             <p className="text-xs text-muted-foreground">
               Be specific about what the AI got wrong and what the correct interpretation should be.
             </p>
           </div>
 
           {/* Corrected Position (after processing) */}
           {correctedPosition && (
             <div className="space-y-2">
               <Label className="text-sm font-medium flex items-center gap-2">
                 <Sparkles className="h-4 w-4 text-primary" />
                 Corrected Analysis
               </Label>
               <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm whitespace-pre-line">
                 {correctedPosition}
               </div>
               <Badge variant="secondary" className="text-xs">
                 ✓ Learning saved - AI will remember this for future analyses in "{position.category}"
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
                 <>
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   Reanalyzing...
                 </>
               ) : (
                 <>
                   <Send className="h-4 w-4 mr-2" />
                   Submit & Reanalyze
                 </>
               )}
             </Button>
           )}
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }