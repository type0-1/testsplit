import { JobGroup } from './JobGroup';

interface PlatformLimits {
  maxJobs: number;
  maxTestsPerJob: number;
}

const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  'GitHub Actions': {
    maxJobs: 256,
    maxTestsPerJob: 1000,
  },
  'GitLab CI': {
    maxJobs: 500,
    maxTestsPerJob: 1000,
  },
};

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

  const limits = PLATFORM_LIMITS[platformName];
  if (!limits) {
    return;
  }

  if (jobs.length > limits.maxJobs) {
    console.warn(
      `[Validation Warning] ${platformName}: ${jobs.length} jobs exceeds recommended limit (${limits.maxJobs})`,
    );
  }

  for (const job of jobs) {
    if (job.tests.length > limits.maxTestsPerJob) {
      console.warn(
        `[Validation Warning] ${platformName}: job ${job.id} has ${job.tests.length} tests, exceeds recommended per-job limit (${limits.maxTestsPerJob})`,
      );
    }
  }
}
