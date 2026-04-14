import {
  createAnalysesHooks,
  type BaseAnalystAnalysis,
  type BaseExtractedPosition,
  type BaseAnalystPrecedent,
  type ConfidenceLevel,
} from '@/lib/analyst/createAnalysesHooks';

export type CloudComputeAnalysisType = 'agreement_vs_bible' | 'termsheet_vs_bible';
export type CloudComputePerspective = 'tenant' | 'provider';
export type CloudComputeConfidenceLevel = ConfidenceLevel;

export interface CloudComputeAnalysis extends BaseAnalystAnalysis {
  analysis_type: CloudComputeAnalysisType;
  perspective: CloudComputePerspective;
  service_type: string | null;
  deployment_model: string | null;
  tenant_name: string | null;
  provider_name: string | null;
  tenant_normalized: string | null;
  provider_normalized: string | null;
}

export interface CloudComputeExtractedPosition extends BaseExtractedPosition {
  confidence: CloudComputeConfidenceLevel;
}

export interface CloudComputePrecedent extends BaseAnalystPrecedent {
  perspective: CloudComputePerspective;
  service_type: string | null;
  deployment_model: string | null;
  confidence: CloudComputeConfidenceLevel;
  tenant_name: string | null;
  provider_name: string | null;
  tenant_normalized: string | null;
  provider_normalized: string | null;
}

const hooks = createAnalysesHooks<CloudComputeAnalysis, CloudComputeExtractedPosition, CloudComputePrecedent>({
  analystType: 'cloud_compute',
  analysesTable: 'cloud_compute_analyses',
  positionsTable: 'cloud_compute_extracted_positions',
  precedentBankTable: 'cloud_compute_precedent_bank',
  analysesQueryKey: 'cloud-compute-analyses',
  positionsQueryKey: 'cloud-compute-positions',
  precedentBankQueryKey: 'cloud-compute-precedent-bank',
  createWithPositionsRpc: 'create_cloud_compute_analysis_with_positions',
  bankSuccessMessage: 'Positions banked to cloud compute precedent library',
});

export const useCloudComputeAnalyses = hooks.useAnalyses;
export const useCloudComputePositions = hooks.usePositions;
export const useCloudComputePrecedentBank = hooks.usePrecedentBank;
