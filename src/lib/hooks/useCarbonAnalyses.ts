import {
  createAnalysesHooks,
  type BaseAnalystAnalysis,
  type BaseExtractedPosition,
  type BaseAnalystPrecedent,
  type ConfidenceLevel,
} from '@/lib/analyst/createAnalysesHooks';

export type CarbonAnalysisType = 'carbon_vs_bible' | 'termsheet_vs_bible';
export type CarbonPerspective = 'buyer' | 'seller';
export type CarbonConfidenceLevel = ConfidenceLevel;

export interface CarbonAnalysis extends BaseAnalystAnalysis {
  analysis_type: CarbonAnalysisType;
  perspective: CarbonPerspective;
  carbon_type: string | null;
  project_stage: string | null;
  buyer_name: string | null;
  seller_name: string | null;
  buyer_normalized: string | null;
  seller_normalized: string | null;
}

export interface CarbonExtractedPosition extends BaseExtractedPosition {
  confidence: CarbonConfidenceLevel;
}

export interface CarbonPrecedent extends BaseAnalystPrecedent {
  perspective: CarbonPerspective;
  carbon_type: string | null;
  project_stage: string | null;
  confidence: CarbonConfidenceLevel;
  buyer_name: string | null;
  seller_name: string | null;
  buyer_normalized: string | null;
  seller_normalized: string | null;
}

const hooks = createAnalysesHooks<CarbonAnalysis, CarbonExtractedPosition, CarbonPrecedent>({
  analystType: 'carbon',
  analysesTable: 'carbon_analyses',
  positionsTable: 'carbon_extracted_positions',
  precedentBankTable: 'carbon_precedent_bank',
  analysesQueryKey: 'carbon-analyses',
  positionsQueryKey: 'carbon-positions',
  precedentBankQueryKey: 'carbon-precedent-bank',
  createWithPositionsRpc: 'create_carbon_analysis_with_positions',
  bankSuccessMessage: 'Positions banked to carbon precedent library',
});

export const useCarbonAnalyses = hooks.useAnalyses;
export const useCarbonPositions = hooks.usePositions;
export const useCarbonPrecedentBank = hooks.usePrecedentBank;
