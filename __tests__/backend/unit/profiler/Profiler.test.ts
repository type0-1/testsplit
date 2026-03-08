import { Profiler } from '../../../../src/backend/profiler/core/Profiler';
import { TestResult } from '../../../../src/backend/models/TestResult';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
  });

  it('computes total and average duration correctly', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 2, status: 'passed' },
      { name: 'B.test2', duration: 4, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.totalDuration).toBe(6);
    expect(profile.averageDuration).toBe(3);
    expect(profile.testCount).toBe(2);
  });

  it('preserves test results in the profile', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 1, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.testResults).toEqual(results);
  });

  it('throws an error when no test results are provided', () => {
    expect(() => profiler.generateProfile([])).toThrow();
  });
});
