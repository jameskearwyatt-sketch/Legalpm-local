/**
 * AnalystAskAIDialog — targeted Q&A for one extracted position.
 *
 * Shared across all 5 analyst report components (PPA, Tolling, Carbon, IT
 * Supply, Cloud Compute). The dialog opens from a "?" Ask AI icon button on
 * every position row. It shows the current clause context (summary, source
 * text, market-position label) as a read-only block, then a textarea for a
 * question and the rendered answer.
 *
 * On submit, the dialog fires a semantic top-K retrieval against the user's
 * own precedent bank + learnings table for this analyst, using the position
 * summary + the question as the query text. Those results are passed to the
 * `ask-analyst-position` edge function as grounding context, alongside the
 * clause-level metadata. The edge function composes the system prompt and
 * returns a single answer string + token counts.
 *
 * Telemetry: we log the call to `analyst_llm_call_log` on both success and
 * failure so the admin dashboard can see Ask-AI usage alongside analyse-*
 * calls.
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, MessageCircleQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { embedText, matchPrecedents, matchLearnings } from '@/lib/analyst/semanticRetrieval';
import type { AnalystType } from '@/lib/analyst/semanticRetrieval';
import { logLlmCall, classifyLlmError } from '@/lib/analyst/llmCallLog';

export interface AskAIPositionContext {
  category: string;
  positionSummary: string;
  sourceText?: string | null;
  marketPosition?: string | null;
  partyFavorability?: string | null;
  confidence?: string | null;
  varianceNotes?: string | null;
}

interface PrecedentRow {
  project_name?: string | null;
  jurisdiction?: string | null;
  position_summary?: string | null;
  market_position?: string | null;
  party_favorability?: string | null;
  is_gold_standard?: boolean | null;
}

interface LearningRow {
  original_position?: string | null;
  corrected_position?: string | null;
  correction_reason?: string | null;
  user_feedback?: string | null;
}

interface AnalystAskAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analyst: AnalystType;
  analystLabel: string;
  position: AskAIPositionContext;
  projectName?: string | null;
  jurisdiction?: string | null;
  contractType?: string | null;
}

const SUGGESTED_QUESTIONS = [
  'Explain in plain English why this is market or off-market.',
  'Draft fallback language that pulls this back to on-market.',
  'What should I push back on and what should I concede?',
  'What are the practical risks of this as drafted?',
];

export function AnalystAskAIDialog({
  open, onOpenChange, analyst, analystLabel, position,
  projectName, jurisdiction, contractType,
}: AnalystAskAIDialogProps) {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!question.trim()) {
      toast.error('Enter a question first');
      return;
    }
    setIsAsking(true);
    setAnswer(null);
    const startedAt = Date.now();
    try {
      const queryText = `${position.category} — ${position.positionSummary} — ${question}`.slice(0, 3000);
      const embedding = await embedText(queryText);
      const [precedentRows, learningRows] = embedding
        ? await Promise.all([
            matchPrecedents<PrecedentRow>(analyst, embedding, 5, 0.3, false),
            matchLearnings<LearningRow>(analyst, embedding, 5, 0.3),
          ])
        : [null, null];

      const relevantPrecedents = (precedentRows || [])
        .filter(p => p.position_summary)
        .map(p => ({
          project_name: p.project_name,
          jurisdiction: p.jurisdiction,
          position_summary: p.position_summary as string,
          market_position: p.market_position,
          party_favorability: p.party_favorability,
          is_gold_standard: !!p.is_gold_standard,
        }));

      const relevantLearnings = (learningRows || [])
        .filter(l => l.corrected_position)
        .map(l => ({
          original_position: l.original_position,
          corrected_position: l.corrected_position as string,
          correction_reason: l.correction_reason || l.user_feedback || null,
        }));

      const { data, error } = await supabase.functions.invoke('ask-analyst-position', {
        body: {
          analyst,
          analystLabel,
          category: position.category,
          positionSummary: position.positionSummary,
          sourceText: position.sourceText,
          marketPosition: position.marketPosition,
          partyFavorability: position.partyFavorability,
          confidence: position.confidence,
          varianceNotes: position.varianceNotes,
          projectName,
          jurisdiction,
          contractType,
          question,
          relevantPrecedents,
          relevantLearnings,
        },
      });
      if (error) throw error;
      if (!data?.answer) throw new Error('Empty answer from AI');

      setAnswer(data.answer as string);
      void logLlmCall({
        analystType: analyst,
        functionName: 'ask-analyst-position',
        status: 'success',
        inputChars: queryText.length,
        inputTokenCount: data.input_tokens ?? null,
        outputTokenCount: data.output_tokens ?? null,
        modelUsed: data.model_used ?? null,
        durationMs: Date.now() - startedAt,
        metadata: {
          category: position.category,
          precedents_retrieved: relevantPrecedents.length,
          learnings_retrieved: relevantLearnings.length,
        },
      });
    } catch (err) {
      console.error('ask-analyst-position failed:', err);
      const errorType = classifyLlmError(err);
      void logLlmCall({
        analystType: analyst,
        functionName: 'ask-analyst-position',
        status: 'failure',
        errorType,
        errorMessage: err instanceof Error ? err.message.slice(0, 500) : 'unknown',
        durationMs: Date.now() - startedAt,
        metadata: { category: position.category },
      });
      toast.error(
        err instanceof Error && err.message.toLowerCase().includes('rate limit')
          ? 'Rate limit — try again in a moment.'
          : 'Failed to get an answer. Please try again.'
      );
    } finally {
      setIsAsking(false);
    }
  };

  const handleClose = () => {
    setQuestion('');
    setAnswer(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5 text-primary" />
            Ask AI — {position.category}
          </DialogTitle>
          <DialogDescription>
            Ask a question about this clause. The AI grounds its answer in your precedent bank and prior corrections for {analystLabel} deals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Clause Context</Label>
            <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-line">
              {position.positionSummary}
            </div>
            {position.sourceText && (
              <div className="text-xs text-muted-foreground line-clamp-3">
                Source: {position.sourceText}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {position.marketPosition && (
                <Badge variant="outline" className="text-xs">{position.marketPosition}</Badge>
              )}
              {position.partyFavorability && (
                <Badge variant="outline" className="text-xs">{position.partyFavorability}</Badge>
              )}
              {position.confidence && (
                <Badge variant="outline" className="text-xs">confidence: {position.confidence}</Badge>
              )}
            </div>
          </div>

          {!answer && (
            <div className="space-y-2">
              <Label htmlFor="ask-question" className="text-sm font-medium">Your question</Label>
              <Textarea
                id="ask-question"
                placeholder="e.g., 'Is this curtailment clause market for a UK solar PPA?'"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                disabled={isAsking}
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuestion(q)}
                    disabled={isAsking}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answer && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Answer
              </Label>
              <ScrollArea className="max-h-80 rounded-lg border">
                <div className="p-3 text-sm whitespace-pre-line">{answer}</div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                Grounded in retrieved precedents + prior corrections. Verify against the full clause before relying on it.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {answer ? 'Done' : 'Cancel'}
          </Button>
          {!answer && (
            <Button onClick={handleAsk} disabled={isAsking || !question.trim()}>
              {isAsking ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Thinking...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Ask</>
              )}
            </Button>
          )}
          {answer && (
            <Button onClick={() => { setAnswer(null); setQuestion(''); }}>
              Ask another
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
