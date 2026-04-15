import { AnalystTeachFeedbackDialog } from '@/components/shared/AnalystTeachFeedbackDialog';
import { useCarbonLearnings } from '@/lib/hooks/useCarbonLearnings';
import { CarbonExtractedPosition } from '@/lib/hooks/useCarbonAnalyses';

interface CarbonTeachFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: CarbonExtractedPosition;
  analysisId: string;
  projectName: string;
  onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void;
}

export function CarbonTeachFeedbackDialog({
  open, onOpenChange, position, analysisId, onPositionUpdated,
}: CarbonTeachFeedbackDialogProps) {
  const learningsHook = useCarbonLearnings();
  return (
    <AnalystTeachFeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      analysisId={analysisId}
      analyst="carbon"
      positionsTableName="carbon_extracted_positions"
      analystLabel="carbon credit offtake"
      placeholder="e.g., 'The vintage window is actually 2025-2030, not 2024-2028. See Schedule 2...'"
      learningsHook={learningsHook}
      onPositionUpdated={onPositionUpdated}
    />
  );
}
