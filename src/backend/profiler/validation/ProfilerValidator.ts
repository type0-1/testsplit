import { TestResult } from '../../models/TestResult'

export function validateResults(results: TestResult[]): void {
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('No test results provided for profiling');
  }

  for (const result of results) {
    if (!Number.isFinite(result.duration) || result.duration < 0) {
      throw new Error(`Invalid duration for test ${result.name}`);
    }
  }
}

