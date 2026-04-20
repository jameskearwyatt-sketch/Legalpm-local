import { useSyncExternalStore } from 'react';

export type AnalystType = 'ppa' | 'tolling' | 'carbon' | 'it_supply' | 'cloud_compute';

export interface BackgroundJob {
  id: string;
  analystType: AnalystType;
  analystLabel: string;
  projectName: string;
  status: 'running' | 'complete' | 'failed';
  phase: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  analysisId?: string;
  routePath: string;
}

const ANALYST_LABELS: Record<AnalystType, string> = {
  ppa: 'PPA',
  tolling: 'Tolling',
  carbon: 'Carbon Credit',
  it_supply: 'IT Supply',
  cloud_compute: 'Cloud Compute',
};

const ANALYST_ROUTES: Record<AnalystType, string> = {
  ppa: '/ppa-analyst',
  tolling: '/tolling-analyst',
  carbon: '/carbon-credit-analyst',
  it_supply: '/it-supply-analyst',
  cloud_compute: '/cloud-compute-analyst',
};

let activeJob: BackgroundJob | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function registerJob(analystType: AnalystType, projectName: string): string {
  const id = crypto.randomUUID();
  activeJob = {
    id,
    analystType,
    analystLabel: ANALYST_LABELS[analystType],
    projectName,
    status: 'running',
    phase: 'extract',
    startedAt: Date.now(),
    routePath: ANALYST_ROUTES[analystType],
  };
  emit();
  return id;
}

export function updateJobPhase(phase: string) {
  if (activeJob && activeJob.status === 'running') {
    activeJob = { ...activeJob, phase };
    emit();
  }
}

export function completeJob(analysisId: string) {
  if (activeJob && activeJob.status === 'running') {
    activeJob = {
      ...activeJob,
      status: 'complete',
      phase: 'complete',
      analysisId,
      completedAt: Date.now(),
    };
    emit();
  }
}

export function failJob(error: string) {
  if (activeJob && activeJob.status === 'running') {
    activeJob = {
      ...activeJob,
      status: 'failed',
      error,
      completedAt: Date.now(),
    };
    emit();
  }
}

export function getActiveJob(): BackgroundJob | null {
  return activeJob;
}

export function dismissJob() {
  activeJob = null;
  emit();
}

export function hasRunningJob(): boolean {
  return activeJob?.status === 'running' || false;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBackgroundAnalysis() {
  const job = useSyncExternalStore(subscribe, getActiveJob, getActiveJob);
  return job;
}
