import { AnalystTeachFeedbackDialog } from '@/components/shared/AnalystTeachFeedbackDialog';
import { useCloudComputeLearnings } from '@/lib/hooks/useCloudComputeLearnings';
import { CloudComputeExtractedPosition } from '@/lib/hooks/useCloudComputeAnalyses';

interface CloudComputeTeachFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: CloudComputeExtractedPosition;
  analysisId: string;
  projectName: string;
  onPositionUpdated?: (newSummary: string, newVarianceNotes?: string) => void;
}

export function CloudComputeTeachFeedbackDialog({
  open, onOpenChange, position, analysisId, onPositionUpdated,
}: CloudComputeTeachFeedbackDialogProps) {
  const learningsHook = useCloudComputeLearnings();
  return (
    <AnalystTeachFeedbackDialog
      open={open}
      onOpenChange={onOpenChange}
      position={position}
      analysisId={analysisId}
      analyst="cloud_compute"
      positionsTableName="cloud_compute_extracted_positions"
      analystLabel="cloud compute"
      placeholder="e.g., 'The SLA is actually 99.99%, not 99.9%...'"
      learningsHook={learningsHook}
      onPositionUpdated={onPositionUpdated}
    />
  );
}
