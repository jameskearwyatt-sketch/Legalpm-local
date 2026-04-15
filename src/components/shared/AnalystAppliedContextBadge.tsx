import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, BookOpen, Award, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Displays which learnings, raw precedents and gold-standard templates were
 * in play when an analysis was generated. Click to see the detail.
 *
 * This is an audit / provenance trail. It tells the user "this answer was
 * shaped by N corrections you have previously fed back to the AI" and
 * lists them. Builds trust in the feedback loop and lets users debug the
 * AI's output when it surprises them.
 */
export interface AppliedLearningDetail {
  id: string;
  category: string;
  user_feedback: string;
  corrected_position: string | null;
  created_at: string;
}

export interface AppliedPrecedentDetail {
  id: string;
  category: string;
  project_name: string;
  jurisdiction: string | null;
  is_gold_standard?: boolean;
  template_name?: string | null;
}

interface AnalystAppliedContextBadgeProps {
  appliedLearningIds: string[];
  appliedPrecedentIds: string[];
  appliedGoldStandardIds: string[];
  learnings: AppliedLearningDetail[];
  precedents: AppliedPrecedentDetail[];
  analysisCreatedAt?: string;
}

export function AnalystAppliedContextBadge({
  appliedLearningIds,
  appliedPrecedentIds,
  appliedGoldStandardIds,
  learnings,
  precedents,
  analysisCreatedAt,
}: AnalystAppliedContextBadgeProps) {
  const [open, setOpen] = useState(false);

  const learningCount = appliedLearningIds?.length ?? 0;
  const precedentCount = appliedPrecedentIds?.length ?? 0;
  const goldCount = appliedGoldStandardIds?.length ?? 0;
  const total = learningCount + precedentCount + goldCount;

  // Nothing to show
  if (total === 0) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Info className="h-3 w-3" />
        No prior context applied
      </Badge>
    );
  }

  const appliedLearnings = learnings.filter((l) => appliedLearningIds.includes(l.id));
  const appliedPrecedents = precedents.filter((p) =>
    appliedPrecedentIds.includes(p.id) || appliedGoldStandardIds.includes(p.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">
            Informed by {learningCount > 0 && `${learningCount} correction${learningCount === 1 ? '' : 's'}`}
            {learningCount > 0 && (precedentCount + goldCount > 0) && ', '}
            {goldCount > 0 && `${goldCount} gold-standard${goldCount === 1 ? '' : 's'}`}
            {goldCount > 0 && precedentCount > 0 && ', '}
            {precedentCount > 0 && `${precedentCount} precedent${precedentCount === 1 ? '' : 's'}`}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Applied Context Trace
          </DialogTitle>
          <DialogDescription>
            These are the prior learnings and precedents that shaped this analysis
            {analysisCreatedAt && (
              <> (generated {formatDistanceToNow(new Date(analysisCreatedAt), { addSuffix: true })})</>
            )}
            . Removing or deactivating any of them will change future analyses.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-5">
            {appliedLearnings.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Your corrections applied ({appliedLearnings.length})
                </h3>
                <div className="space-y-2">
                  {appliedLearnings.map((l) => (
                    <div key={l.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {l.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-foreground">⚠️ {l.user_feedback}</p>
                      {l.corrected_position && (
                        <p className="text-muted-foreground mt-1 italic">
                          → {l.corrected_position}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {appliedPrecedents.filter((p) => p.is_gold_standard).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Gold-standard templates applied
                </h3>
                <div className="space-y-2">
                  {appliedPrecedents
                    .filter((p) => p.is_gold_standard)
                    .map((p) => (
                      <div key={p.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {p.template_name || p.project_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.category}
                              {p.jurisdiction && ` · ${p.jurisdiction}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {appliedPrecedents.filter((p) => !p.is_gold_standard).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Raw precedents applied
                </h3>
                <div className="space-y-2">
                  {appliedPrecedents
                    .filter((p) => !p.is_gold_standard)
                    .map((p) => (
                      <div key={p.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{p.project_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.category}
                          {p.jurisdiction && ` · ${p.jurisdiction}`}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
