import { createLearningsHook, type BaseAnalystLearning } from '@/lib/analyst/createLearningsHook';

export type CloudComputeLearning = BaseAnalystLearning;

export const useCloudComputeLearnings = createLearningsHook<CloudComputeLearning>({
  tableName: 'cloud_compute_learnings',
  queryKey: 'cloud-compute-learnings',
  analystType: 'cloud_compute',
});
