import { AnalystLearningsTab } from '@/components/shared/AnalystLearningsTab';
import { useITSupplyLearnings } from '@/lib/hooks/useITSupplyLearnings';

export function ITSupplyLearningsTab() {
  const hook = useITSupplyLearnings();
  return <AnalystLearningsTab hook={hook} description="IT supply (chip/server) analysis accuracy" />;
}
