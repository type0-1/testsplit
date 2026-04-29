import { Job } from '../../../../src/backend/algorithm/model/Job';
import { JobDistribution } from '../../../../src/backend/algorithm/model/JobDistribution';
import {
  MIN_VIABLE_JOB_S,
  adaptiveCapWarning,
  computeAdaptiveJobCount,
} from '../../../../src/backend/utils/adaptiveJobCap';

function makeDistribution(totalTimes: number[]): JobDistribution {
  const jobs = totalTimes.map((time, index) => {
    const job = new Job(index + 1);
    job.totalTime = time;
    return job;
  });

  const totalDuration = totalTimes.reduce((sum, time) => sum + time, 0);

  return {
    jobs,
    jobCount: jobs.length,
    totalDuration,
    metrics: {
      criticalPath: Math.max(...totalTimes, 0),
      minJobTime: Math.min(...totalTimes, 0),
      idealJobTime: jobs.length === 0 ? 0 : totalDuration / jobs.length,
      balanceRatio: 1,
      predictedSpeedUp: 1,
    },
  };
}

describe('computeAdaptiveJobCount', () => {
  test('keeps requested jobs when --jobs is explicitly provided', () => {
    const distribution = makeDistribution([40, 35, 25]);

    const result = computeAdaptiveJobCount(distribution, 6, true);

    expect(result).toEqual({
      jobCount: 6,
      reduced: false,
      totalDuration: 100,
    });
  });

  test('does not reduce when inferred cap is at or above requested count', () => {
    const requestedJobs = 4;
    const distribution = makeDistribution([100, 100, 100]);

    const result = computeAdaptiveJobCount(distribution, requestedJobs, false);

    expect(result.jobCount).toBe(requestedJobs);
    expect(result.reduced).toBe(false);
    expect(result.totalDuration).toBe(300);
  });

  test('reduces jobs based on floor(totalDuration / MIN_VIABLE_JOB_S)', () => {
    const requestedJobs = 8;
    const distribution = makeDistribution([120, 120, 110]);

    const result = computeAdaptiveJobCount(distribution, requestedJobs, false);

    expect(result.jobCount).toBe(Math.floor(350 / MIN_VIABLE_JOB_S));
    expect(result.reduced).toBe(true);
    expect(result.totalDuration).toBe(350);
  });

  test('never goes below 2 jobs when jobs are not explicit', () => {
    const requestedJobs = 10;
    const distribution = makeDistribution([20, 15, 10]);

    const result = computeAdaptiveJobCount(distribution, requestedJobs, false);

    expect(result.jobCount).toBe(2);
    expect(result.reduced).toBe(true);
    expect(result.totalDuration).toBe(45);
  });
});

describe('adaptiveCapWarning', () => {
  test('returns a warning with one decimal place and override hint', () => {
    const message = adaptiveCapWarning(119.94, 6, 2);

    expect(message).toBe(
      'Warning: test suite total duration (119.9s) is too short for 6 jobs -- runner startup overhead would dominate. Reducing to 2 job(s). Use --jobs to override.',
    );
  });
});