import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InstabilityRow } from '../../src/components/instability/InstabilityRow'
import type { TestStat } from '../../src/types/api'

vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
}))

function makeStat(overrides: Partial<TestStat>): TestStat {
  return {
    testName: 'com.example.MyTest.flakyMethod',
    runCount: 10,
    meanDuration: 0.8,
    stdDev: 0.24,
    min: 0.5,
    max: 1.2,
    coefficientOfVariation: 0.30,
    isOutlier: false,
    unstable: false,
    zeroDuration: false,
    ...overrides,
  }
}

describe('InstabilityRow', () => {
  it('renders the method name', () => {
    render(<InstabilityRow test={makeStat({})} index={0} maxCv={1} />)
    expect(screen.getByText('flakyMethod')).toBeInTheDocument()
  })

  it('renders the CV percentage', () => {
    render(<InstabilityRow test={makeStat({})} index={0} maxCv={1} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('renders stdDev and mean', () => {
    render(<InstabilityRow test={makeStat({})} index={0} maxCv={1} />)
    expect(screen.getByText(/σ 0\.24s/)).toBeInTheDocument()
    expect(screen.getByText(/μ 0\.80s/)).toBeInTheDocument()
  })

  it('shows OUTLIER badge when isOutlier is true', () => {
    render(<InstabilityRow test={makeStat({ isOutlier: true })} index={0} maxCv={1} />)
    expect(screen.getByText('OUTLIER')).toBeInTheDocument()
  })

  it('shows UNSTABLE badge when unstable and not an outlier', () => {
    render(<InstabilityRow test={makeStat({ unstable: true })} index={0} maxCv={1} />)
    expect(screen.getByText('UNSTABLE')).toBeInTheDocument()
  })

  it('shows only OUTLIER badge when both isOutlier and unstable are true', () => {
    render(<InstabilityRow test={makeStat({ isOutlier: true, unstable: true })} index={0} maxCv={1} />)
    expect(screen.getByText('OUTLIER')).toBeInTheDocument()
    expect(screen.queryByText('UNSTABLE')).toBeNull()
  })
})
