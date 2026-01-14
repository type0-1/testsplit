import { Job } from '../model/Job';

export interface SchedulingMetrics {
  criticalPath: number; // The longest job time measured (maximum job time)
  minJobTime: number;
  idealJobTime: number;
  balanceRatio: number;
  predictedSpeedUp: number;
}

export function computeMetrics( jobs: Job[], totalDuration: number): SchedulingMetrics {
  const times = jobs.map(j => j.totalTime);
  const max = Math.max(...times);
  const min = Math.min(...times);
  const ideal = totalDuration / jobs.length;

  return {
    criticalPath: max,
    minJobTime: min,
    idealJobTime: ideal,
    balanceRatio: ideal === 0 ? 1 : max / ideal, //  Measure for LPT algorithm goal of minimising parallel execution time
    predictedSpeedUp: max === 0 ? 1: totalDuration / max
  };

}
