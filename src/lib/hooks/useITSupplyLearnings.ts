import { createLearningsHook, type BaseAnalystLearning } from '@/lib/analyst/createLearningsHook';

export type ITSupplyLearning = BaseAnalystLearning;

export const useITSupplyLearnings = createLearningsHook<ITSupplyLearning>({
  tableName: 'it_supply_learnings',
  queryKey: 'it-supply-learnings',
  analystType: 'it_supply',
});
