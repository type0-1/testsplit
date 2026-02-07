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
    const zeroRun: TestResult[] = [
      { name: 'ZeroTest', duration: 0, status: 'passed' },
    ];

    profiler.addRun(zeroRun);

    const historical = profiler.generateHistoricalProfile();
    const stats = historical.perTestStats['ZeroTest'];

    expect(stats.zeroDuration).toBe(true);
  });
});
