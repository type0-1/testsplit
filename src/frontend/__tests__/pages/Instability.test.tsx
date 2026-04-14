import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Instability } from '../../src/pages/Instability'
import { useApi } from '../../src/hooks/useApi'
import type { SummaryResponse, TestsResponse } from '../../src/types/api'

vi.mock('../../src/hooks/useApi')
vi.mock('../../src/hooks/useCalibration', () => ({ useCalibration: () => true }))
vi.mock('../../src/hooks/useCountUp', () => ({ useCountUp: (t: number) => t }))
vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div> },
}))
vi.mock('../../src/components/instability/ScatterPanel', () => ({ ScatterPanel: () => <div data-testid="scatter" /> }))
vi.mock('../../src/components/PageLoadingSkeleton', () => ({ PageLoadingSkeleton: ({ title }: { title: string }) => <div>Loading {title}</div> }))

const mockSummary: SummaryResponse = {
  totalTests: 2, runCount: 3, avgDuration: 0.8, unstableCount: 1,
  outlierCount: 1, makespan: 5.0, speedupFactor: 2.5,
  balanceRatio: 0.9, sequentialDuration: 12.0, cpuCores: 4,
}
const mockTests: TestsResponse = {
  total: 2, limit: 500, offset: 0,
  tests: [
    { testName: 'com.example.FlakyTest.run', runCount: 3, meanDuration: 0.8, stdDev: 0.3, min: 0.5, max: 1.2, coefficientOfVariation: 0.375, isOutlier: true, unstable: true, zeroDuration: false },
    { testName: 'com.example.StableTest.run', runCount: 3, meanDuration: 0.5, stdDev: 0.01, min: 0.49, max: 0.51, coefficientOfVariation: 0.02, isOutlier: false, unstable: false, zeroDuration: false },
  ],
}

function setupApi(overrides: Record<string, Partial<ReturnType<typeof useApi>>> = {}) {
  vi.mocked(useApi).mockImplementation((url: string) => {
    const defaults: Record<string, ReturnType<typeof useApi>> = {
      '/api/summary': { data: mockSummary, loading: false, error: null },
      '/api/tests?sort=cv&limit=500': { data: mockTests, loading: false, error: null },
    }
    return { ...defaults[url], ...overrides[url] } as ReturnType<typeof useApi>
  })
}

describe('Instability page', () => {
  beforeEach(() => { setupApi() })

  it('shows a loading skeleton while fetching', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: true, error: null })
    render(<Instability />)
    expect(screen.getByText(/Loading Instability/i)).toBeInTheDocument()
  })

  it('shows an error state when an API call fails', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: false, error: 'Timeout' })
    render(<Instability />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Timeout')).toBeInTheDocument()
  })

  it('renders the page title on success', () => {
    render(<Instability />)
    expect(screen.getByText('Instability')).toBeInTheDocument()
  })

  it('renders the unstable count badge', () => {
    render(<Instability />)
    expect(screen.getByText('1 UNSTABLE')).toBeInTheDocument()
  })

  it('renders a row for each test', () => {
    render(<Instability />)
    expect(screen.getByTitle('com.example.FlakyTest.run')).toBeInTheDocument()
    expect(screen.getByTitle('com.example.StableTest.run')).toBeInTheDocument()
  })
})
