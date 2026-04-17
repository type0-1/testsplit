import { detectRegressions } from '../../../../src/backend/profiler/core/RegressionDetector';
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

describe('detectRegressions', () => {
  it('returns empty array when fewer than 2 deltas', () => {
    expect(detectRegressions([])).toEqual([]);
    expect(detectRegressions([makeDelta()])).toEqual([]);
  });

  it('returns empty array when latest is within threshold', () => {
    const a = makeDelta({ criticalPath: 50, balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 54, balanceRatio: 1.05 }, '2026-01-02T00:00:00.000Z');
    // 8% and 5% - both under default 10% threshold
    expect(detectRegressions([a, b])).toEqual([]);
  });

  it('flags criticalPath when latest exceeds rolling average by more than threshold', () => {
    const a = makeDelta({ criticalPath: 50 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 60 }, '2026-01-02T00:00:00.000Z'); // +20%
    const flags = detectRegressions([a, b]);

    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe('criticalPath');
    expect(flags[0].rollingAverage).toBe(50);
    expect(flags[0].current).toBe(60);
    expect(flags[0].changePercent).toBeCloseTo(0.2);
  });

  it('flags balanceRatio when latest exceeds rolling average by more than threshold', () => {
    const a = makeDelta({ balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ balanceRatio: 1.5 }, '2026-01-02T00:00:00.000Z'); // +50%
    const flags = detectRegressions([a, b]);

    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe('balanceRatio');
  });

  it('flags both metrics when both regress beyond threshold', () => {
    const a = makeDelta({ criticalPath: 50, balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 70, balanceRatio: 2.0 }, '2026-01-02T00:00:00.000Z');
    const flags = detectRegressions([a, b]);

    expect(flags).toHaveLength(2);
    expect(flags.map(f => f.metric)).toContain('criticalPath');
    expect(flags.map(f => f.metric)).toContain('balanceRatio');
  });

  it('computes rolling average across all previous runs, not just the last one', () => {
    const a = makeDelta({ criticalPath: 40 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 60 }, '2026-01-02T00:00:00.000Z');
    const c = makeDelta({ criticalPath: 80 }, '2026-01-03T00:00:00.000Z'); // rolling avg of a+b = 50, +60%
    const flags = detectRegressions([a, b, c]);

    expect(flags).toHaveLength(1);
    expect(flags[0].rollingAverage).toBe(50);
    expect(flags[0].current).toBe(80);
  });

  it('does not flag an improvement', () => {
    const a = makeDelta({ criticalPath: 80 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 40 }, '2026-01-02T00:00:00.000Z'); // improved
    expect(detectRegressions([a, b])).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const a = makeDelta({ criticalPath: 50 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 56 }, '2026-01-02T00:00:00.000Z'); // +12%
    expect(detectRegressions([a, b], 0.10)).toHaveLength(1);
    expect(detectRegressions([a, b], 0.15)).toHaveLength(0);
  });

  it('sorts deltas by createdAt before selecting latest', () => {
    const newest = makeDelta({ criticalPath: 70 }, '2026-01-03T00:00:00.000Z');
    const oldest = makeDelta({ criticalPath: 50 }, '2026-01-01T00:00:00.000Z');
    const middle = makeDelta({ criticalPath: 55 }, '2026-01-02T00:00:00.000Z');

    const flags = detectRegressions([newest, oldest, middle]);

    expect(flags).toHaveLength(1);
    expect(flags[0].metric).toBe('criticalPath');
    expect(flags[0].current).toBe(70);
  });

  it('does not flag criticalPath when rolling average is zero', () => {
    const a = makeDelta({ criticalPath: 0, balanceRatio: 1.0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 100, balanceRatio: 1.0 }, '2026-01-02T00:00:00.000Z');

    const flags = detectRegressions([a, b]);

    expect(flags.some((f) => f.metric === 'criticalPath')).toBe(false);
  });

  it('does not flag balanceRatio when rolling average is zero', () => {
    const a = makeDelta({ criticalPath: 50, balanceRatio: 0 }, '2026-01-01T00:00:00.000Z');
    const b = makeDelta({ criticalPath: 50, balanceRatio: 2.0 }, '2026-01-02T00:00:00.000Z');

    const flags = detectRegressions([a, b]);

    expect(flags.some((f) => f.metric === 'balanceRatio')).toBe(false);
  });
});
