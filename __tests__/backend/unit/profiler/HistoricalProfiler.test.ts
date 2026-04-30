import { HistoricalProfiler } from '../../../../src/backend/profiler/core/HistoricalProfiler';
import { TestResult } from '../../../../src/backend/models/TestResult';
import { StoredHistoricalDelta } from '../../../../src/backend/models/StoredHistoricalDelta';
import { HistoricalDelta } from '../../../../src/backend/models/HistoricalDelta';
import { detectRegressions } from '../../../../src/backend/profiler/core/RegressionDetector';

function makeDelta(overrides: Partial<HistoricalDelta> = {}, createdAt = '2026-01-01T00:00:00.000Z'): StoredHistoricalDelta {
  return {
    createdAt,
    deltas: {
      runAt: createdAt,
      commit: null,
      testCount: 10,
      totalDuration: 100,
      averageDuration: 10,
      criticalPath: 50,
      balanceRatio: 1.0,
      ...overrides,
    },
  };
}

describe('HistoricalProfiler', () => {
  let profiler: HistoricalProfiler;

  beforeEach(() => {
    profiler = new HistoricalProfiler();
  });

  const run1: TestResult[] = [
    { name: 'TestA', duration: 2, status: 'passed' },
    { name: 'TestB', duration: 4, status: 'passed' },
  ];

  const run2: TestResult[] = [
    { name: 'TestA', duration: 4, status: 'passed' },
    { name: 'TestB', duration: 6, status: 'passed' },
  ];

  it('adds a profiling run and returns a Profile', () => {
    const profile = profiler.addRun(run1);

    expect(profile.testCount).toBe(2);
    expect(profile.totalDuration).toBe(6);
    expect(profile.averageDuration).toBe(3);
  });

  it('addProfile stores a profile instance', () => {
    const profile = profiler.generateProfile(run1);

    profiler.addProfile(profile);

    const historical = profiler.generateHistoricalProfile();
    expect(historical.runCount).toBe(1);
    expect(historical.totalTests).toBe(2);
  });

  it('addProfiles appends all provided profiles', () => {
    const profileA = profiler.generateProfile(run1);
    const profileB = profiler.generateProfile(run2);

    profiler.addProfiles([profileA, profileB]);

    const historical = profiler.generateHistoricalProfile();
    expect(historical.runCount).toBe(2);
    expect(historical.totalTests).toBe(4);
  });

  it('getProfiles returns a defensive copy of the profiles array', () => {
    profiler.addRun(run1);

    const snapshot = profiler.getProfiles();
    snapshot.push(profiler.generateProfile(run2));

    expect(profiler.getProfiles()).toHaveLength(1);
  });

  it('setProfiles copies input array instead of retaining external reference', () => {
    const profile = profiler.generateProfile(run1);
    const input = [profile];

    profiler.setProfiles(input);
    input.push(profiler.generateProfile(run2));

    expect(profiler.getProfiles()).toHaveLength(1);
  });

  it('handles empty duration arrays in per-test stats fallback branches', () => {
    const stats = (profiler as any).computePerTestStats({ EmptyTest: [] });

    expect(stats.EmptyTest.runCount).toBe(0);
    expect(stats.EmptyTest.meanDuration).toBe(0);
    expect(stats.EmptyTest.variance).toBe(0);
    expect(stats.EmptyTest.min).toBe(0);
    expect(stats.EmptyTest.max).toBe(0);
    expect(stats.EmptyTest.coefficientOfVariation).toBe(0);
    expect(stats.EmptyTest.unstable).toBe(false);
    expect(stats.EmptyTest.zeroDuration).toBe(false);
    expect(stats.EmptyTest.isOutlier).toBe(false);
  });

  it('throws an error when generating historical profile with no runs', () => {
    expect(() => profiler.generateHistoricalProfile()).toThrow(
      'No profiling runs available',
    );
  });

  it('aggregates multiple runs correctly', () => {
    profiler.addRun(run1);
    profiler.addRun(run2);

    const historical = profiler.generateHistoricalProfile();

    expect(historical.runCount).toBe(2);
    expect(historical.totalTests).toBe(4);
  });

  it('computes correct mean duration across all runs', () => {
    profiler.addRun(run1);
    profiler.addRun(run2);

    const historical = profiler.generateHistoricalProfile();

    // durations are (2, 4, 4, 6), 16/4 = 4
    expect(historical.averageTestDuration).toBe(4);
  });

  it('computes correct variance across all runs', () => {
    profiler.addRun(run1);
    profiler.addRun(run2);

    const historical = profiler.generateHistoricalProfile();

    // variance = ((2-4)^2 + (4-4)^2 + (4-4)^2 + (6-4)^2) / 4 = (4 + 0 + 0 + 4) / 4 = 2
    expect(historical.testDurationVariance).toBe(2);
  });

  it('reset clears all stored profiles', () => {
    profiler.addRun(run1);
    profiler.reset();

    expect(() => profiler.generateHistoricalProfile()).toThrow();
  });

  it('marks stable tests as not unstable', () => {
    const stableRun1: TestResult[] = [
      { name: 'StableTest', duration: 10, status: 'passed' },
    ];

    const stableRun2: TestResult[] = [
      { name: 'StableTest', duration: 11, status: 'passed' },
    ];

    profiler.addRun(stableRun1);
    profiler.addRun(stableRun2);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['StableTest'];

    expect(stats.unstable).toBe(false);
    expect(stats.zeroDuration).toBe(false);
  });

  it('detects unstable tests using coefficient of variation', () => {
    const spikyRun1: TestResult[] = [
      { name: 'SpikyTest', duration: 1, status: 'passed' },
    ];

    const spikyRun2: TestResult[] = [
      { name: 'SpikyTest', duration: 10, status: 'passed' },
    ];

    profiler.addRun(spikyRun1);
    profiler.addRun(spikyRun2);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['SpikyTest'];

    expect(stats.unstable).toBe(true);
  });

  it('flags tests with zero duration', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const zeroRun: TestResult[] = [
      { name: 'ZeroTest', duration: 0, status: 'passed' },
    ];

    profiler.addRun(zeroRun);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['ZeroTest'];

    expect(stats.zeroDuration).toBe(true);
    warnSpy.mockRestore();
  });

  it('collects differing metadata from each run into metadata array', () => {
    const metadata1 = {
      commit: { hash: 'abc', message: 'test' } as any,
      generatedAt: '2024-01-01',
      cpuModel: 'Intel',
      cpuCores: 8,
      osVersion: 'macOS',
      platform: 'darwin',
      nodeVersion: 'v18',
      containerVersion: '1.0',
    };

    const metadata2 = {
      ...metadata1,
      cpuModel: 'AMD',
    };

    profiler.setProfiles([
      {
        schemaVersion: 1,
        testResults: [],
        testCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        metadata: metadata1,
      },
      {
        schemaVersion: 1,
        testResults: [],
        testCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        metadata: metadata2,
      },
    ]);

    const historical = profiler.generateHistoricalProfile();

    expect(historical.metadata).toHaveLength(2);
    expect(historical.metadata[0].cpuModel).toBe('Intel');
    expect(historical.metadata[1].cpuModel).toBe('AMD');
  });
  it('applies smoothing when multiple runs exist', () => {
    profiler.addRun([{ name: 'TestA', duration: 10, status: 'passed' }]);
    profiler.addRun([{ name: 'TestA', duration: 20, status: 'passed' }]);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['TestA'];

    expect(stats.meanDuration).toBeCloseTo(13);
  });

  it('flags a test as an outlier when its mean duration is far above the suite mean', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // 6 normal tests are needed to dilute the outlier's effect on the suite mean + 2σ threshold
    profiler.addRun([
      { name: 'TestA', duration: 1, status: 'passed' },
      { name: 'TestB', duration: 1, status: 'passed' },
      { name: 'TestC', duration: 1, status: 'passed' },
      { name: 'TestD', duration: 1, status: 'passed' },
      { name: 'TestE', duration: 1, status: 'passed' },
      { name: 'TestF', duration: 1, status: 'passed' },
      { name: 'SlowTest', duration: 100, status: 'passed' },
    ]);

    const historical = profiler.generateHistoricalProfile();

    expect(historical.perTestStats['SlowTest'].isOutlier).toBe(true);
    expect(historical.perTestStats['TestA'].isOutlier).toBe(false);
    warnSpy.mockRestore();
  });

  it('does not flag a test as an outlier when only one test exists', () => {
    profiler.addRun([{ name: 'OnlyTest', duration: 999, status: 'passed' }]);

    const historical = profiler.generateHistoricalProfile();

    expect(historical.perTestStats['OnlyTest'].isOutlier).toBe(false);
  });

  it('delegates static detectRegressions to RegressionDetector', () => {
    const a = makeDelta({ averageDuration: 10 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ averageDuration: 12 }, '2026-01-02T00:00:00.000Z');

    const expected = detectRegressions([a, b], 0.1);
    const actual = HistoricalProfiler.detectRegressions([a, b], 0.1);

    expect(actual).toEqual(expected);
  });

  it('uses default threshold when static detectRegressions threshold is omitted', () => {
    const a = makeDelta({ averageDuration: 10 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ averageDuration: 12 }, '2026-01-02T00:00:00.000Z');

    const expected = detectRegressions([a, b], 0.1);
    const actual = HistoricalProfiler.detectRegressions([a, b]);

    expect(actual).toEqual(expected);
  });
});
