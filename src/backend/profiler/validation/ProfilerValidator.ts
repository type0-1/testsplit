import { TestResult } from '../../models/TestResult';
import { ProfileMetadata } from '../model/Profile';

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

export function flagZeroDurationTests(results: TestResult[]): TestResult[] {
  return results.filter((r) => r.duration === 0);
}

export function detectOutlierTests(results: TestResult[]): string[] {
  if (results.length < 2) return [];

  const durations = results.map((r) => r.duration);
  const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  return results.filter((r) => r.duration > mean + 2 * stdDev).map((r) => r.name);
}

export function validateCommitPresence(metadata: ProfileMetadata): void {
  if (!metadata.commit) {
    console.warn('Warning: no commit information available in profile metadata');
  }
}

