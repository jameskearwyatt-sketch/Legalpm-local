import { createLearningsHook, type BaseAnalystLearning } from '@/lib/analyst/createLearningsHook';

export type CarbonLearning = BaseAnalystLearning;

export const useCarbonLearnings = createLearningsHook<CarbonLearning>({
  tableName: 'carbon_learnings',
  queryKey: 'carbon-learnings',
  analystType: 'carbon',
});
