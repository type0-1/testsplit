import { HistoricalProfiler } from '../../../../src/backend/profiler/core/HistoricalProfiler';
import { TestResult } from '../../../../src/backend/models/TestResult';
import { StoredHistoricalDelta } from '../../../../src/backend/models/StoredHistoricalDelta';
import { HistoricalDelta } from '../../../../src/backend/models/HistoricalDelta';

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

  it('reduces spike impact using smoothing', () => {
    profiler.addRun([{ name: 'SpikeTest', duration: 10, status: 'passed' }]);
    profiler.addRun([{ name: 'SpikeTest', duration: 100, status: 'passed' }]);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['SpikeTest'];

    // Raw mean would be 55
    expect(stats.meanDuration).toBeLessThan(55);
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
});

describe('HistoricalProfiler.detectRegressions', () => {
  it('returns empty array when fewer than 2 deltas', () => {
    expect(HistoricalProfiler.detectRegressions([])).toEqual([]);
    expect(HistoricalProfiler.detectRegressions([makeDelta()])).toEqual([]);
  });

  it('returns empty array when latest is within threshold', () => {
    const a = makeDelta({ criticalPath: 50, balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 54, balanceRatio: 1.05 }, '2026-01-02T00:00:00.000Z');
    // 8% and 5% - both under default 10% threshold
    expect(HistoricalProfiler.detectRegressions([a, b])).toEqual([]);
  });

  it('flags criticalPath when latest exceeds rolling average by more than threshold', () => {
    const a = makeDelta({ criticalPath: 50 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 60 }, '2026-01-02T00:00:00.000Z'); // +20%
    const flags = HistoricalProfiler.detectRegressions([a, b]);

    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe('criticalPath');
    expect(flags[0].rollingAverage).toBe(50);
    expect(flags[0].current).toBe(60);
    expect(flags[0].changePercent).toBeCloseTo(0.2);
  });

  it('flags balanceRatio when latest exceeds rolling average by more than threshold', () => {
    const a = makeDelta({ balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ balanceRatio: 1.5 }, '2026-01-02T00:00:00.000Z'); // +50%
    const flags = HistoricalProfiler.detectRegressions([a, b]);

    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe('balanceRatio');
  });

  it('flags both metrics when both regress beyond threshold', () => {
    const a = makeDelta({ criticalPath: 50, balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 70, balanceRatio: 2.0 }, '2026-01-02T00:00:00.000Z');
    const flags = HistoricalProfiler.detectRegressions([a, b]);

    expect(flags).toHaveLength(2);
    expect(flags.map(f => f.metric)).toContain('criticalPath');
    expect(flags.map(f => f.metric)).toContain('balanceRatio');
  });

  it('computes rolling average across all previous runs, not just the last one', () => {
    const a = makeDelta({ criticalPath: 40 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 60 }, '2026-01-02T00:00:00.000Z');
    const c = makeDelta({ criticalPath: 80 }, '2026-01-03T00:00:00.000Z'); // rolling avg of a+b = 50, +60%
    const flags = HistoricalProfiler.detectRegressions([a, b, c]);

    expect(flags).toHaveLength(1);
    expect(flags[0].rollingAverage).toBe(50);
    expect(flags[0].current).toBe(80);
  });

  it('does not flag an improvement', () => {
    const a = makeDelta({ criticalPath: 80 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 40 }, '2026-01-02T00:00:00.000Z'); // improved
    expect(HistoricalProfiler.detectRegressions([a, b])).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const a = makeDelta({ criticalPath: 50 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 56 }, '2026-01-02T00:00:00.000Z'); // +12%
    // With 10% threshold: regression. With 15% threshold: clean.
    expect(HistoricalProfiler.detectRegressions([a, b], 0.10)).toHaveLength(1);
    expect(HistoricalProfiler.detectRegressions([a, b], 0.15)).toHaveLength(0);
  });
});
