import { JobResult } from './ParallelRunner';
import { Job } from '../algorithm/model/Job';
import { TestResult } from '../models/TestResult';
import { FileStore } from '../storage/FileStore';
import { HistoricalProfiler } from '../profiler/core/HistoricalProfiler';
import { generateRunId } from '../helpers/RunId';

/**
 * Distributes each job's measured wall-clock time proportionally across its tests
 * using the originally scheduled durations as weights.
 *
 * If all scheduled durations are zero, time is split equally.
 * wallClockMs is converted to seconds to match JUnit XML duration units.
 */
export function buildObservedTestResults(results: JobResult[], jobs: Job[]): TestResult[] {
  const scheduledDuration: Record<string, number> = {};

  for (const job of jobs) {
    for (const task of job.tasks) {
      scheduledDuration[task.id] = task.duration;
    }
  }

  const observed: TestResult[] = [];

  for (const result of results) {
    const { wallClockMs, testNames, exitCode } = result;
    const totalScheduled = testNames.reduce((sum, name) => sum + (scheduledDuration[name] ?? 0), 0);

    for (const name of testNames) {
      const weight = totalScheduled > 0 ? (scheduledDuration[name] ?? 0) / totalScheduled: 1 / testNames.length;

      observed.push({
        name,
        duration: (wallClockMs / 1000) * weight,
        status: exitCode === 0 ? 'passed' : 'failed'
      });
    }
  }

  return observed;
}

/**
 * Feeds observed timings back into the profiler storage so subsequent
 * LPT/MULTIFIT assignments use real measured durations instead of XML estimates.
 */
export function persistObservedTimings(results: JobResult[], jobs: Job[], baseDir?: string): void {
  const observed = buildObservedTestResults(results, jobs);
  if (observed.length === 0) return;

  const store = new FileStore(baseDir);
  const profiler = new HistoricalProfiler();

  for (const profile of store.loadProfiles()) {
    profiler.addProfile(profile);
  }

  const runProfile = profiler.generateProfile(observed);
  profiler.addProfile(runProfile);

  const runId = generateRunId();
  store.saveProfile(runId, runProfile);
  store.saveHistoricalProfile(profiler.generateHistoricalProfile());
}
