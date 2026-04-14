import {
  createAnalysesHooks,
  type BaseAnalystAnalysis,
  type BaseExtractedPosition,
  type BaseAnalystPrecedent,
  type ConfidenceLevel,
} from '@/lib/analyst/createAnalysesHooks';

export type ITSupplyAnalysisType = 'contract_vs_bible' | 'termsheet_vs_bible';
export type ITSupplyPerspective = 'buyer' | 'supplier';
export type ITSupplyConfidenceLevel = ConfidenceLevel;

export interface ITSupplyAnalysis extends BaseAnalystAnalysis {
  analysis_type: ITSupplyAnalysisType;
  perspective: ITSupplyPerspective;
  supply_type: string | null;
  contract_stage: string | null;
  buyer_name: string | null;
  supplier_name: string | null;
  buyer_normalized: string | null;
  supplier_normalized: string | null;
}

export interface ITSupplyExtractedPosition extends BaseExtractedPosition {
  confidence: ITSupplyConfidenceLevel;
}

export interface ITSupplyPrecedent extends BaseAnalystPrecedent {
  perspective: ITSupplyPerspective;
  supply_type: string | null;
  contract_stage: string | null;
  confidence: ITSupplyConfidenceLevel;
  buyer_name: string | null;
  supplier_name: string | null;
  buyer_normalized: string | null;
  supplier_normalized: string | null;
}

const hooks = createAnalysesHooks<ITSupplyAnalysis, ITSupplyExtractedPosition, ITSupplyPrecedent>({
  analystType: 'it_supply',
  analysesTable: 'it_supply_analyses',
  positionsTable: 'it_supply_extracted_positions',
  precedentBankTable: 'it_supply_precedent_bank',
  analysesQueryKey: 'it-supply-analyses',
  positionsQueryKey: 'it-supply-positions',
  precedentBankQueryKey: 'it-supply-precedent-bank',
  createWithPositionsRpc: 'create_it_supply_analysis_with_positions',
  bankSuccessMessage: 'Positions banked to IT supply precedent library',
});

export const useITSupplyAnalyses = hooks.useAnalyses;
export const useITSupplyPositions = hooks.usePositions;
export const useITSupplyPrecedentBank = hooks.usePrecedentBank;
