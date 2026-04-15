import { describe, it, expect } from 'vitest'
import { percentageChange, detectRegression, formatRunLabel } from '../../src/lib/utils'
import type { TrendPoint } from '@/types/api'

function makeTrend(overrides: Partial<TrendPoint>): TrendPoint {
  return {
    runAt: '2024-01-01T00:00:00Z',
    totalDuration: 1000,
    averageDuration: 100,
    testCount: 10,
    criticalPath: 500,
    balanceRatio: 0.9,
    ...overrides,
  }
}

describe('percentageChange', () => {
  it('returns the fractional change between two values', () => {
    expect(percentageChange(110, 100)).toBeCloseTo(0.1)
  })

  it('returns a negative delta for a decrease', () => {
    expect(percentageChange(90, 100)).toBeCloseTo(-0.1)
  })

  it('returns null when prev is undefined', () => {
    expect(percentageChange(100, undefined)).toBeNull()
  })

  it('returns null when prev is zero (avoid division by zero)', () => {
    expect(percentageChange(100, 0)).toBeNull()
  })
})

describe('detectRegression', () => {
  it('returns null with fewer than 2 trend points', () => {
    expect(detectRegression([])).toBeNull()
  })

  it('returns null with exactly 1 trend point', () => {
    expect(detectRegression([makeTrend({})])).toBeNull()
  })

  it('returns null when neither metric regresses by more than 10%', () => {
    const trends = [
      makeTrend({ criticalPath: 500, totalDuration: 1000 }),
      makeTrend({ criticalPath: 505, totalDuration: 1005 }),
    ]
    expect(detectRegression(trends)).toBeNull()
  })

  it('detects a makespan regression > 10%', () => {
    const trends = [
      makeTrend({ criticalPath: 500, totalDuration: 1000 }),
      makeTrend({ criticalPath: 560, totalDuration: 1000 }),
    ]
    const result = detectRegression(trends)
    expect(result).not.toBeNull()
    expect(result!.field).toBe('makespan')
    expect(result!.pct).toBeCloseTo(0.12)
  })

  it('detects a total duration regression > 10%', () => {
    const trends = [
      makeTrend({ criticalPath: 500, totalDuration: 1000 }),
      makeTrend({ criticalPath: 500, totalDuration: 1150 }),
    ]
    const result = detectRegression(trends)
    expect(result).not.toBeNull()
    expect(result!.field).toBe('total duration')
    expect(result!.pct).toBeCloseTo(0.15)
  })

  it('prefers makespan regression when both exceed threshold', () => {
    const trends = [
      makeTrend({ criticalPath: 500, totalDuration: 1000 }),
      makeTrend({ criticalPath: 600, totalDuration: 1200 }),
    ]
    const result = detectRegression(trends)
    expect(result!.field).toBe('makespan')
  })

  it('returns null when prev criticalPath is zero', () => {
    const trends = [
      makeTrend({ criticalPath: 0, totalDuration: 0 }),
      makeTrend({ criticalPath: 600, totalDuration: 1200 }),
    ]
    expect(detectRegression(trends)).toBeNull()
  })
})

describe('formatRunLabel', () => {
  it('formats a valid ISO date string as short date', () => {
    const label = formatRunLabel('2024-06-15T12:00:00Z', 0)
    expect(label).toMatch(/Jun/)
    expect(label).toMatch(/15/)
  })

  it('falls back to "Run N+1" for an invalid date string', () => {
    expect(formatRunLabel('not-a-date', 2)).toBe('Run 3')
  })
})
