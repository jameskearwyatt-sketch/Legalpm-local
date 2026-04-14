import {
  createAnalysesHooks,
  type BaseAnalystAnalysis,
  type BaseExtractedPosition,
  type BaseAnalystPrecedent,
  type ConfidenceLevel,
} from '@/lib/analyst/createAnalysesHooks';

export type TollingAnalysisType = 'tolling_vs_bible' | 'tolling_vs_termsheet' | 'termsheet_vs_bible';
export type TollingPerspective = 'offtaker' | 'generator';
export type TollingConfidenceLevel = ConfidenceLevel;

export interface TollingAnalysis extends BaseAnalystAnalysis {
  analysis_type: TollingAnalysisType;
  perspective: TollingPerspective;
  tolling_type: string | null;
  facility_stage: string | null;
  offtaker_name: string | null;
  generator_name: string | null;
  offtaker_normalized: string | null;
  generator_normalized: string | null;
}

export interface TollingExtractedPosition extends BaseExtractedPosition {
  confidence: TollingConfidenceLevel;
}

export interface TollingPrecedent extends BaseAnalystPrecedent {
  perspective: TollingPerspective;
  tolling_type: string | null;
  facility_stage: string | null;
  confidence: TollingConfidenceLevel;
  offtaker_name: string | null;
  generator_name: string | null;
  offtaker_normalized: string | null;
  generator_normalized: string | null;
}

const hooks = createAnalysesHooks<TollingAnalysis, TollingExtractedPosition, TollingPrecedent>({
  analystType: 'tolling',
  analysesTable: 'tolling_analyses',
  positionsTable: 'tolling_extracted_positions',
  precedentBankTable: 'tolling_precedent_bank',
  analysesQueryKey: 'tolling-analyses',
  positionsQueryKey: 'tolling-positions',
  precedentBankQueryKey: 'tolling-precedent-bank',
  createWithPositionsRpc: 'create_tolling_analysis_with_positions',
  bankSuccessMessage: 'Positions banked to tolling precedent library',
});

export const useTollingAnalyses = hooks.useAnalyses;
export const useTollingPositions = hooks.usePositions;
export const useTollingPrecedentBank = hooks.usePrecedentBank;
