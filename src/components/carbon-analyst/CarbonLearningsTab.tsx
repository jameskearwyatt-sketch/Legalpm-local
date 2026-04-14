import { AnalystLearningsTab } from '@/components/shared/AnalystLearningsTab';
import { useCarbonLearnings } from '@/lib/hooks/useCarbonLearnings';

export function CarbonLearningsTab() {
  const hook = useCarbonLearnings();
  return <AnalystLearningsTab hook={hook} description="carbon credit offtake analysis accuracy" />;
}
