import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Scale, User, Building2, Lightbulb, AlertCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TollingPrecedent } from '@/lib/hooks/useTollingAnalyses';

interface WhatsMarketResult {
  category: string;
  dealCount: number;
  balanced: { title: string; summary: string; points: string[] };
  buyerFriendly: { title: string; summary: string; points: string[] };
  sellerFriendly: { title: string; summary: string; points: string[] };
  keyInsights: string[];
  confidenceNote: string;
}

interface TollingWhatsMarketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  precedents: TollingPrecedent[];
}

export function TollingWhatsMarketDialog({ open, onOpenChange, category, precedents }: TollingWhatsMarketDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WhatsMarketResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('whats-market', {
        body: {
          category,
          precedents: precedents.map(p => ({
            project_name: p.project_name,
            jurisdiction: p.jurisdiction,
            perspective: p.perspective,
            position_summary: p.position_summary,
            ppa_type: p.tolling_type || null,
            market_position: p.market_position || null,
            party_favorability: p.party_favorability || null,
            buyer_name: p.offtaker_name || null,
            seller_name: p.generator_name || null,
          })),
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const hasTriggered = useRef(false);
  useEffect(() => {
    if (open && !hasTriggered.current) {
      hasTriggered.current = true;
      handleAnalyze();
    }
    if (!open) {
      hasTriggered.current = false;
      setResult(null);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            What's Market? — {category}
          </DialogTitle>
          <DialogDescription>
            Synthesized from {precedents.length} banked precedent{precedents.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing {precedents.length} precedents…</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {result && !isLoading && (
          <div className="space-y-4">
            <Tabs defaultValue="balanced" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="balanced" className="gap-1.5">
                  <Scale className="h-3.5 w-3.5" />
                  Balanced
                </TabsTrigger>
                <TabsTrigger value="offtaker" className="gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Offtaker-Friendly
                </TabsTrigger>
                <TabsTrigger value="generator" className="gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  Generator-Friendly
                </TabsTrigger>
              </TabsList>

              <TabsContent value="balanced" className="mt-4">
                <PositionSection data={result.balanced} variant="balanced" />
              </TabsContent>
              <TabsContent value="offtaker" className="mt-4">
                <PositionSection data={result.buyerFriendly} variant="offtaker" />
              </TabsContent>
              <TabsContent value="generator" className="mt-4">
                <PositionSection data={result.sellerFriendly} variant="generator" />
              </TabsContent>
            </Tabs>

            {result.keyInsights && result.keyInsights.length > 0 && (
              <div className="p-3 bg-accent/50 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Key Insights
                </div>
                <ul className="space-y-1">
                  {result.keyInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.confidenceNote && (
              <p className="text-xs text-muted-foreground italic border-t pt-3">
                📊 {result.confidenceNote}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PositionSection({
  data,
  variant,
}: {
  data: { title: string; summary: string; points: string[] };
  variant: 'balanced' | 'offtaker' | 'generator';
}) {
  const borderColor = {
    balanced: 'border-l-primary',
    offtaker: 'border-l-emerald-500',
    generator: 'border-l-orange-500',
  }[variant];

  return (
    <div className={`border-l-4 ${borderColor} pl-4 space-y-3`}>
      <p className="text-sm font-medium text-foreground">{data.summary}</p>
      <ul className="space-y-2">
        {data.points.map((point, i) => (
          <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
