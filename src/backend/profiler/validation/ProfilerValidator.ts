import { TestResult } from '../../models/TestResult'

export function validateResults(results: TestResult[]): void {
  if (!Array.isArray(results)) {
    throw new Error('Profiler input must be an array');
  }

  for (const result of results) {
    if (!Number.isFinite(result.duration) || result.duration < 0) {
      throw new Error(`Invalid duration for test ${result.name}`);
    }
  }
}
