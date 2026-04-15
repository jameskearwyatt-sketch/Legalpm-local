import { AnalystLearningsTab } from '@/components/shared/AnalystLearningsTab';
import { useTollingLearnings } from '@/lib/hooks/useTollingLearnings';

export function TollingLearningsTab() {
  const hook = useTollingLearnings();
  return <AnalystLearningsTab hook={hook} description="tolling analysis accuracy" />;
}
