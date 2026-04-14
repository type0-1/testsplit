import { describe, it, expect } from 'vitest'
import { testStatusColor, testStatusColorDim } from '../../src/lib/testStatus'
import type { TestStat } from '@/types/api'

function makeStat(overrides: Partial<TestStat>): TestStat {
  return {
    testName: 'com.example.Test.method',
    runCount: 5,
    meanDuration: 100,
    stdDev: 10,
    min: 80,
    max: 120,
    coefficientOfVariation: 0.1,
    isOutlier: false,
    unstable: false,
    zeroDuration: false,
    ...overrides,
  }
}

describe('testStatusColor', () => {
  it('returns orange for outliers', () => {
    expect(testStatusColor(makeStat({ isOutlier: true }))).toBe('var(--orange)')
  })

  it('returns amber for unstable tests (non-outlier)', () => {
    expect(testStatusColor(makeStat({ unstable: true }))).toBe('var(--amber)')
  })

  it('outlier takes precedence over unstable', () => {
    expect(testStatusColor(makeStat({ isOutlier: true, unstable: true }))).toBe('var(--orange)')
  })

  it('returns the default stable colour (cyan) for healthy tests', () => {
    expect(testStatusColor(makeStat({}))).toBe('var(--cyan)')
  })

  it('respects a custom stable colour override', () => {
    expect(testStatusColor(makeStat({}), 'var(--g6)')).toBe('var(--g6)')
  })
})

describe('testStatusColorDim', () => {
  it('returns orange-dim for outliers', () => {
    expect(testStatusColorDim(makeStat({ isOutlier: true }))).toBe('var(--orange-dim)')
  })

  it('returns amber-dim for unstable tests', () => {
    expect(testStatusColorDim(makeStat({ unstable: true }))).toBe('var(--amber-dim)')
  })

  it('returns the default stable dim colour (cyan-dim) for healthy tests', () => {
    expect(testStatusColorDim(makeStat({}))).toBe('var(--cyan-dim)')
  })

  it('respects a custom stable dim colour override', () => {
    expect(testStatusColorDim(makeStat({}), 'var(--g4)')).toBe('var(--g4)')
  })
})
