import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, X, ArrowRight } from 'lucide-react';
import { useBackgroundAnalysis, dismissJob } from '@/lib/analyst/backgroundAnalysis';
import { cn } from '@/lib/utils';

const PHASE_LABELS: Record<string, string> = {
  extract: 'Extracting text',
  retrieve: 'Building intelligence',
  analyze: 'Running analysis',
  save: 'Saving results',
  complete: 'Complete',
};

export function AnalysisStatusBar() {
  const job = useBackgroundAnalysis();
  const [elapsedSec, setElapsedSec] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (job) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [job?.id]);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    const tick = () => setElapsedSec(Math.floor((Date.now() - job.startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job?.id, job?.status]);

  if (!job) return null;

  const isRunning = job.status === 'running';
  const isComplete = job.status === 'complete';
  const isFailed = job.status === 'failed';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div
      className={cn(
        'fixed top-3 z-50 transition-all duration-500',
        'right-4 lg:right-8',
        'left-auto',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl',
          'bg-card/95 backdrop-blur-md border shadow-lg',
          'max-w-sm',
          isRunning && 'animate-analysis-glow',
          isComplete && 'analysis-complete-glow',
          isFailed && 'border-destructive/40',
        )}
      >
        {isRunning && (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        )}
        {isComplete && (
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        )}
        {isFailed && (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {job.analystLabel}
            </span>
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              {job.projectName}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {isRunning && (
              <>
                {PHASE_LABELS[job.phase] || job.phase}
                <span className="ml-1.5 tabular-nums">{formatTime(elapsedSec)}</span>
              </>
            )}
            {isComplete && 'Analysis complete'}
            {isFailed && (job.error ? `Failed: ${job.error.slice(0, 60)}` : 'Analysis failed')}
          </p>
        </div>

        {isComplete && (
          <Link
            to={job.routePath}
            onClick={dismissJob}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            View
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}

        {!isRunning && (
          <button
            onClick={dismissJob}
            className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
