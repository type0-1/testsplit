import { JobDistribution } from '../algorithm/model/JobDistribution';

export const MIN_VIABLE_JOB_S = 60; // Min # of secs a job should run to assume startup overhead is dominant

export interface AdaptiveCapResult {
  jobCount: number;
  reduced: boolean;
  totalDuration: number;
}

/**
 * Given an initial job distribution and whether the user explicitly passed --jobs,
 * returns the adapted job count & reduces to avoid runner startup overhead dominating.
 */

export function computeAdaptiveJobCount(
  distribution: JobDistribution,
  requestedJobCount: number,
  jobsExplicit: boolean,
): AdaptiveCapResult {
  
  const totalDuration = distribution.jobs.reduce((s, j) => s + j.totalTime, 0);
  if (jobsExplicit) return { jobCount: requestedJobCount, reduced: false, totalDuration };

  const jobCount = Math.max(2, Math.min(requestedJobCount, Math.floor(totalDuration / MIN_VIABLE_JOB_S)));
  
  return { jobCount, reduced: jobCount < requestedJobCount, totalDuration };
}

export function adaptiveCapWarning(totalDuration: number, from: number, to: number): string {
  return `Warning: test suite total duration (${totalDuration.toFixed(1)}s) is too short for ${from} jobs -- runner startup overhead would dominate. Reducing to ${to} job(s). Use --jobs to override.`;
}
