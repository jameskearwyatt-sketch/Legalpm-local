import { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  AnalystType,
  SimilarLearning,
  findSimilarLearnings,
} from '@/lib/analyst/semanticRetrieval';

/**
 * Inline warning banner for the "Teach / Correct" dialogs across all 5
 * analyst tools. While the user is composing a new learning we debounce
 * a similarity search against existing active learnings in the same
 * category, and if anything looks like a likely duplicate / conflict we
 * surface it with its similarity score, so the user can decide whether
 * to merge, supersede, or proceed anyway.
 *
 * Failure modes:
 *   - If the embedding backend is unavailable the component renders
 *     nothing (the hook gets `null` back). We don't block submission.
 *   - If the text is too short we also render nothing.
 */
interface Props {
  analyst: AnalystType;
  category: string;
  text: string;
  /** Optional: id of a learning currently being edited, so we don't warn about self. */
  excludeId?: string | null;
  /** Minimum chars before we bother querying. Default 40. */
  minChars?: number;
  /** Debounce ms. Default 600. */
  debounceMs?: number;
}

export function LearningConflictWarning({
  analyst,
  category,
  text,
  excludeId,
  minChars = 40,
  debounceMs = 600,
}: Props) {
  const [conflicts, setConflicts] = useState<SimilarLearning[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!category || !text || text.trim().length < minChars) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const result = await findSimilarLearnings(analyst, category, text);
      if (cancelled) return;
      setLoading(false);
      const filtered = (result || []).filter((r) => r.id !== excludeId);
      setConflicts(filtered);
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [analyst, category, text, excludeId, minChars, debounceMs]);

  if (!conflicts.length) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-sm text-amber-900 dark:text-amber-100">
              {conflicts.length} similar {conflicts.length === 1 ? 'learning' : 'learnings'} already exist in this category
            </span>
            {loading && <span className="text-xs text-muted-foreground">checking...</span>}
          </div>
          <ChevronDown className={`h-4 w-4 text-amber-700 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Saving a near-duplicate can cause the AI to receive conflicting instructions. Consider updating or deleting the existing learning instead.
            </span>
          </p>
          {conflicts.map((c) => {
            const correctionText = c.user_feedback ?? c.correction_reason ?? '';
            const similarityPct = Math.round(c.similarity * 100);
            return (
              <div
                key={c.id}
                className="rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-amber-950/50 p-2 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                    {c.is_active ? 'active' : 'inactive'}
                  </Badge>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{similarityPct}% match</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                {c.corrected_position && (
                  <p className="text-foreground line-clamp-2">
                    <span className="font-medium">Correction:</span> {c.corrected_position}
                  </p>
                )}
                {correctionText && (
                  <p className="text-muted-foreground line-clamp-2">{correctionText}</p>
                )}
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
