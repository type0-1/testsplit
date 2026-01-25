import { JobGroup } from './GitHubActionsGenerator';

export function validateJobGroups(
  jobs: JobGroup[],
  platformName: string,
): void {
  if (jobs.length === 0) {
    throw new Error(`No jobs provided for ${platformName} configuration`);
  }

  for (const job of jobs) {
    if (job.tests.length === 0) {
      throw new Error(`Job ${job.id} has no tests assigned`);
    }
  }
}
