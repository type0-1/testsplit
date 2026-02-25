import {
  flagZeroDurationTests,
  detectOutlierTests,
  validateCommitPresence,
} from '../../../../src/backend/profiler/validation/ProfilerValidator';
import { TestResult } from '../../../../src/backend/models/TestResult';
import { ProfileMetadata } from '../../../../src/backend/profiler/model/Profile';

const passed = (name: string, duration: number): TestResult => ({
  name,
  duration,
  status: 'passed',
});

describe('flagZeroDurationTests', () => {
  it('returns an empty array when no tests have zero duration', () => {
    const results = [passed('TestA', 1), passed('TestB', 2)];

    expect(flagZeroDurationTests(results)).toHaveLength(0);
  });

  it('returns only the zero-duration tests', () => {
    const results = [passed('TestA', 0), passed('TestB', 2), passed('TestC', 0)];
    const flagged = flagZeroDurationTests(results);

    expect(flagged).toHaveLength(2);
    expect(flagged.map((r) => r.name)).toEqual(['TestA', 'TestC']);
  });

  it('returns all tests when every test has zero duration', () => {
    const results = [passed('TestA', 0), passed('TestB', 0)];

    expect(flagZeroDurationTests(results)).toHaveLength(2);
  });
});

describe('detectOutlierTests', () => {
  it('returns an empty array for a single test', () => {
    expect(detectOutlierTests([passed('TestA', 10)])).toHaveLength(0);
  });

  it('returns an empty array when all durations are equal', () => {
    const results = [passed('TestA', 5), passed('TestB', 5), passed('TestC', 5)];

    expect(detectOutlierTests(results)).toHaveLength(0);
  });

  it('detects a test with an outlier duration', () => {
    // Requires at least 5 normal tests for mean + 2σ to flag the outlier
    const results = [
      passed('TestA', 1),
      passed('TestB', 1),
      passed('TestC', 1),
      passed('TestD', 1),
      passed('TestE', 1),
      passed('SlowTest', 100),
    ];
    const outliers = detectOutlierTests(results);

    expect(outliers).toContain('SlowTest');
  });

  it('does not flag tests within normal range', () => {
    const results = [
      passed('TestA', 10),
      passed('TestB', 12),
      passed('TestC', 11),
      passed('TestD', 13),
    ];

    expect(detectOutlierTests(results)).toHaveLength(0);
  });
});

describe('validateCommitPresence', () => {
  const baseMetadata: ProfileMetadata = {
    commit: null,
    generatedAt: '2024-01-01T00:00:00.000Z',
    cpuModel: 'Intel Core i7',
    cpuCores: 8,
    osVersion: 'macOS 14.0',
    platform: 'darwin',
    nodeVersion: 'v20.0.0',
    containerVersion: 'none',
  };

  it('does not warn when commit is present', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    validateCommitPresence({
      ...baseMetadata,
      commit: { sha: 'abc123', timestamp: '2024-01-01T00:00:00.000Z' },
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when commit is null', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    validateCommitPresence({ ...baseMetadata, commit: null });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no commit information'),
    );
    warnSpy.mockRestore();
  });
});
