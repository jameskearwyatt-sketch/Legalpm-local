import { AnalystTeachFeedbackDialog } from '@/components/shared/AnalystTeachFeedbackDialog';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';
import { ITSupplyExtractedPosition } from '@/lib/hooks/useITSupplyAnalyses';

interface ITSupplyTeachFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: ITSupplyExtractedPosition;
  analysisId: string;
  projectName: string;
  onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void;
}

export function ITSupplyTeachFeedbackDialog({
  open, onOpenChange, position, analysisId, onPositionUpdated,
}: ITSupplyTeachFeedbackDialogProps) {
  const learningsHook = useITSupplyLearnings();
  return (
    <AnalystTeachFeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      analysisId={analysisId}
      analyst="it_supply"
      positionsTableName="it_supply_extracted_positions"
      analystLabel="IT supply"
      placeholder="e.g., 'The allocation priority is actually P1, not P2...'"
      learningsHook={learningsHook}
      onPositionUpdated={onPositionUpdated}
    />
  );
}
