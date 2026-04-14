import { AnalystTeachFeedbackDialog } from '@/components/shared/AnalystTeachFeedbackDialog';
import { useTollingLearnings } from '@/lib/hooks/useTollingLearnings';
import { TollingExtractedPosition } from '@/lib/hooks/useTollingAnalyses';

interface TollingTeachFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: TollingExtractedPosition;
  analysisId: string;
  projectName: string;
  onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void;
}

export function TollingTeachFeedbackDialog({
  open, onOpenChange, position, analysisId, onPositionUpdated,
}: TollingTeachFeedbackDialogProps) {
  const learningsHook = useTollingLearnings();
  return (
    <AnalystTeachFeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      analysisId={analysisId}
      analyst="tolling"
      positionsTableName="tolling_extracted_positions"
      analystLabel="tolling"
      placeholder="e.g., 'The heat rate guarantee is actually 7,200 BTU/kWh HHV, not 7,500. See Schedule B...'"
      learningsHook={learningsHook}
      onPositionUpdated={onPositionUpdated}
    />
  );
}
