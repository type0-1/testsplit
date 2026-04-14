import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestRow } from '../../src/components/durations/TestRow'
import type { TestStat } from '../../src/types/api'

vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
}))

function makeStat(overrides: Partial<TestStat>): TestStat {
  return {
    testName: 'com.example.MyTest.shouldPass',
    runCount: 10,
    meanDuration: 1.234,
    stdDev: 0.05,
    min: 1.1,
    max: 1.4,
    coefficientOfVariation: 0.04,
    isOutlier: false,
    unstable: false,
    zeroDuration: false,
    ...overrides,
  }
}

describe('TestRow', () => {
  it('renders the method name', () => {
    render(<TestRow test={makeStat({})} index={0} maxDuration={2} />)
    expect(screen.getByText('shouldPass')).toBeInTheDocument()
  })

  it('renders the class name', () => {
    render(<TestRow test={makeStat({})} index={0} maxDuration={2} />)
    expect(screen.getByText('com.example.MyTest')).toBeInTheDocument()
  })

  it('renders the duration', () => {
    render(<TestRow test={makeStat({})} index={0} maxDuration={2} />)
    expect(screen.getByText('1.234s')).toBeInTheDocument()
  })

  it('shows OUTLIER badge when isOutlier is true', () => {
    render(<TestRow test={makeStat({ isOutlier: true })} index={0} maxDuration={2} />)
    expect(screen.getByText('OUTLIER')).toBeInTheDocument()
  })

  it('shows UNSTABLE badge when unstable is true', () => {
    render(<TestRow test={makeStat({ unstable: true })} index={0} maxDuration={2} />)
    expect(screen.getByText('UNSTABLE')).toBeInTheDocument()
  })

  it('shows no badge for a healthy test', () => {
    render(<TestRow test={makeStat({})} index={0} maxDuration={2} />)
    expect(screen.queryByText('OUTLIER')).toBeNull()
    expect(screen.queryByText('UNSTABLE')).toBeNull()
  })

  it('does not render a class name row when testName has no dot', () => {
    render(<TestRow test={makeStat({ testName: 'topLevelTest' })} index={0} maxDuration={2} />)
    expect(screen.queryByText('com.example.MyTest')).toBeNull()
  })
})
