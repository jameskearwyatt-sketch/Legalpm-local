import { AnalystLearningsTab } from '@/components/shared/AnalystLearningsTab';
import { useCloudComputeLearnings } from '@/lib/hooks/useCloudComputeLearnings';

export function CloudComputeLearningsTab() {
  const hook = useCloudComputeLearnings();
  return <AnalystLearningsTab hook={hook} description="cloud compute services analysis accuracy" />;
}
