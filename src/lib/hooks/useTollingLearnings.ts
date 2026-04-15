import { createLearningsHook, type BaseAnalystLearning } from '@/lib/analyst/createLearningsHook';

export type TollingLearning = BaseAnalystLearning;

export const useTollingLearnings = createLearningsHook<TollingLearning>({
  tableName: 'tolling_learnings',
  queryKey: 'tolling-learnings',
  analystType: 'tolling',
});
