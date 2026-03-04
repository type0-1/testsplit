import { HistoricalProfiler } from '../../../../src/backend/profiler/core/HistoricalProfiler';
import { TestResult } from '../../../../src/backend/models/TestResult';

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

  it('collects metadata from all runs into metadata array', () => {
    const baseMetadata = {
      commit: { hash: 'abc', message: 'test' } as any,
      generatedAt: '2024-01-01',
      cpuModel: 'Intel',
      cpuCores: 8,
      osVersion: 'macOS',
      platform: 'darwin',
      nodeVersion: 'v18',
      containerVersion: '1.0',
    };

    profiler.setProfiles([
      {
        schemaVersion: 1,
        testResults: [],
        testCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        metadata: baseMetadata,
      },
      {
        schemaVersion: 1,
        testResults: [],
        testCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        metadata: baseMetadata,
      },
    ]);

    const historical = profiler.generateHistoricalProfile();

    expect(historical.metadata).toHaveLength(2);
    expect(historical.metadata[0].cpuModel).toBe('Intel');
    expect(historical.metadata[1].cpuModel).toBe('Intel');
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
