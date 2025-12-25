import { Job } from './Job';
import { SchedulingMetrics } from '../metrics/SchedulingMetrics';

export interface JobDistribution {
  jobs: Job[];
  jobCount: number;
  totalDuration: number;
  metrics: SchedulingMetrics;
}
