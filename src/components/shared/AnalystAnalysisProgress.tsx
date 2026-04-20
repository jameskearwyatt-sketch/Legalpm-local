/**
 * Shared progress UI for long-running analyst uploads.
 *
 * The analyst tools each spend 30–90 seconds waiting on the LLM after
 * the contract text has been extracted and precedents retrieved. The
 * previous UX was a static `Loader2` + a single frozen status line,
 * which reads as "the app has hung" to most users.
 *
 * This component gives:
 *   - A smooth animated progress bar anchored to phase targets but
 *     slowly creeping between them, so it always looks alive.
 *   - An elapsed-time counter, updated every second.
 *   - A rotating narrative under the primary status message so users
 *     can see *what* the backend is doing at each moment.
 *
 * Uses structured JSON output from the gateway is unchanged — this is a
 * pure client-side enhancement with no edge-function surface.
 *
 * The `useAnalystProgress` hook drives this component. Upload flows
 * call `progress.setPhase('retrieve')` etc. and the hook handles the
 * smooth interpolation + timer + narrative rotation.
 */
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

export type AnalystProgressPhase =
  | 'idle'
  | 'extract'
  | 'retrieve'
  | 'analyze'
  | 'save'
  | 'complete';

interface PhaseConfig {
  /** Primary status line shown in CardDescription. */
  status: string;
  /** Progress bar target at end of phase. */
  target: number;
  /** Expected wall-clock duration in ms. Used for smooth interpolation. */
  expectedMs: number;
  /** Rotating narrative messages shown in the sub-caption. */
  narrative: string[];
}

const DEFAULT_PHASES: Record<AnalystProgressPhase, PhaseConfig> = {
  idle: {
    status: '',
    target: 0,
    expectedMs: 0,
    narrative: [],
  },
  extract: {
    status: 'Extracting text from document…',
    target: 15,
    expectedMs: 5000,
    narrative: [
      'Reading PDF / Word structure',
      'Normalising clause boundaries',
      'Preparing text for analysis',
    ],
  },
  retrieve: {
    status: 'Building precedent intelligence…',
    target: 35,
    expectedMs: 6000,
    narrative: [
      'Embedding contract into semantic space',
      'Finding the closest banked precedents',
      'Selecting relevant correction history',
      'Assembling gold-standard templates',
    ],
  },
  analyze: {
    status: 'Running AI analysis…',
    target: 85,
    expectedMs: 180000,
    narrative: [
      'Reading the agreement end-to-end',
      'Extracting positions category-by-category',
      'Cross-referencing with your precedent bank',
      'Benchmarking each position against market',
      'Assessing party favorability',
      'Flagging off-market clauses',
      'Marking confidence on each extraction',
      'Finalising structured output',
    ],
  },
  save: {
    status: 'Saving analysis results…',
    target: 98,
    expectedMs: 3000,
    narrative: [
      'Persisting analysis metadata',
      'Writing extracted positions',
    ],
  },
  complete: {
    status: 'Analysis complete',
    target: 100,
    expectedMs: 0,
    narrative: [],
  },
};

interface Props {
  title: string;
  phase: AnalystProgressPhase;
  progress: number;
  narrative: string | null;
  elapsedMs: number;
  statusOverride?: string;
  /** Optional extra note shown at the bottom of the card. */
  footerNote?: string;
  /** If provided, a Cancel button is shown; invoked when the user clicks it. */
  onCancel?: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export function AnalystAnalysisProgress({
  title,
  phase,
  progress,
  narrative,
  elapsedMs,
  statusOverride,
  footerNote = 'Complex contracts can take up to 5 minutes. Feel free to keep this tab open in the background.',
  onCancel,
}: Props) {
  const status = statusOverride ?? DEFAULT_PHASES[phase].status;
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{status}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.round(progress)}%</span>
            <span>Elapsed: {formatElapsed(elapsedMs)}</span>
          </div>
        </div>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        {narrative && (
          <p
            key={narrative}
            className="text-center text-sm text-muted-foreground animate-in fade-in duration-500"
          >
            {narrative}
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground/80">{footerNote}</p>
        {onCancel && phase !== 'complete' && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel analysis"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface AnalystProgressController {
  phase: AnalystProgressPhase;
  /** Current smoothed progress (0–100). */
  progress: number;
  /** Current rotating narrative line, or null for idle/complete. */
  narrative: string | null;
  /** Wall-clock elapsed ms since the first `setPhase` call (excluding idle). */
  elapsedMs: number;
  /** Move to the next phase. Resets interpolation start time. */
  setPhase: (p: AnalystProgressPhase) => void;
  /** Override the primary status line (optional). */
  setStatusOverride: (s: string | null) => void;
  statusOverride: string | null;
  /** Reset everything back to idle. */
  reset: () => void;
}

/**
 * Hook that drives `AnalystAnalysisProgress`.
 *
 * The analyze phase is where the LLM call is made; because its true
 * duration is unknown, we interpolate toward the target asymptotically
 * (capped at 95% of the phase range) rather than hitting the target
 * prematurely. Once the caller moves on to `save` or `complete`, the
 * bar snaps to the next target.
 */
export function useAnalystProgress(): AnalystProgressController {
  const [phase, setPhaseState] = useState<AnalystProgressPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [narrativeIdx, setNarrativeIdx] = useState(0);
  const [tick, setTick] = useState(0); // force re-render for elapsed timer
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const phaseStartRef = useRef<number>(0);
  const phaseStartProgressRef = useRef<number>(0);
  const globalStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const narrativeTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);

  const setPhase = (p: AnalystProgressPhase) => {
    const cfg = DEFAULT_PHASES[p];
    phaseStartRef.current = performance.now();
    phaseStartProgressRef.current = progress;
    if (globalStartRef.current === 0 && p !== 'idle') {
      globalStartRef.current = performance.now();
    }
    if (p === 'idle') {
      globalStartRef.current = 0;
    }
    setPhaseState(p);
    setNarrativeIdx(0);
    if (p === 'complete') {
      setProgress(cfg.target);
    }
  };

  const reset = () => {
    setPhaseState('idle');
    setProgress(0);
    setNarrativeIdx(0);
    setStatusOverride(null);
    globalStartRef.current = 0;
    phaseStartRef.current = 0;
    phaseStartProgressRef.current = 0;
  };

  // Smooth progress interpolation via rAF.
  useEffect(() => {
    if (phase === 'idle' || phase === 'complete') {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const cfg = DEFAULT_PHASES[phase];
    const startTime = phaseStartRef.current;
    const startProgress = phaseStartProgressRef.current;
    const targetProgress = cfg.target;
    // Cap the asymptote: for `analyze`, we never actually reach 85 from
    // interpolation alone — only the caller advancing to `save` completes it.
    const range = targetProgress - startProgress;
    const cap = startProgress + range * 0.95;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const fraction = Math.min(1, elapsed / Math.max(cfg.expectedMs, 1));
      // Ease-out so the bar decelerates as it approaches the cap.
      const eased = 1 - Math.pow(1 - fraction, 2);
      const next = startProgress + (cap - startProgress) * eased;
      setProgress(prev => (next > prev ? next : prev));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase]);

  // Rotate narrative every 3.5s.
  useEffect(() => {
    if (phase === 'idle' || phase === 'complete') {
      if (narrativeTimerRef.current !== null) window.clearInterval(narrativeTimerRef.current);
      narrativeTimerRef.current = null;
      return;
    }
    const cfg = DEFAULT_PHASES[phase];
    if (cfg.narrative.length <= 1) return;
    narrativeTimerRef.current = window.setInterval(() => {
      setNarrativeIdx(i => (i + 1) % cfg.narrative.length);
    }, 3500);
    return () => {
      if (narrativeTimerRef.current !== null) window.clearInterval(narrativeTimerRef.current);
      narrativeTimerRef.current = null;
    };
  }, [phase]);

  // Tick every 1s so elapsedMs re-renders.
  useEffect(() => {
    if (phase === 'idle') {
      if (tickTimerRef.current !== null) window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
      return;
    }
    tickTimerRef.current = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      if (tickTimerRef.current !== null) window.clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    };
  }, [phase]);

  const cfg = DEFAULT_PHASES[phase];
  const narrative = cfg.narrative[narrativeIdx] ?? null;
  const elapsedMs =
    globalStartRef.current === 0 ? 0 : performance.now() - globalStartRef.current;
  // Consume `tick` so the elapsed counter re-renders every second.
  void tick;

  return {
    phase,
    progress,
    narrative,
    elapsedMs,
    setPhase,
    setStatusOverride,
    statusOverride,
    reset,
  };
}
