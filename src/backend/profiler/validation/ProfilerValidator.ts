import { TestResult } from '../../models/TestResult';
import { ProfileMetadata } from '../model/Profile';
import { computeOutlierThreshold } from '../../utils/stats';

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

// Outlier detection logic: see computeOutlierThreshold in utils/stats.ts
export function detectOutlierTests(results: TestResult[]): string[] {
  const threshold = computeOutlierThreshold(results.map((r) => r.duration));
  return results.filter((r) => r.duration > threshold).map((r) => r.name);
}

export function validateCommitPresence(metadata: ProfileMetadata): void {
  if (!metadata.commit) {
    console.warn('Warning: no commit information available in profile metadata');
  }
}

