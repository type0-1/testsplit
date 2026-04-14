import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Overview from '../../src/pages/Overview'
import { useApi } from '../../src/hooks/useApi'
import type { SummaryResponse, TestsResponse, JobsResponse, TrendsResponse } from '../../src/types/api'

vi.mock('../../src/hooks/useApi')
vi.mock('../../src/hooks/useCalibration', () => ({ useCalibration: () => true }))
vi.mock('../../src/hooks/useCountUp', () => ({ useCountUp: (t: number) => t }))
vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div> },
}))
vi.mock('../../src/components/overview/TrendChartPanel', () => ({ TrendChartPanel: () => <div data-testid="trend-chart" /> }))
vi.mock('../../src/components/overview/JobDistributionPanel', () => ({ JobDistributionPanel: () => <div data-testid="job-distribution" /> }))
vi.mock('../../src/components/overview/SlowestTestsPanel', () => ({ SlowestTestsPanel: () => <div data-testid="slowest-tests" /> }))
vi.mock('../../src/components/overview/InstabilityPanel', () => ({ InstabilityPanel: () => <div data-testid="instability-panel" /> }))
vi.mock('../../src/components/PageLoadingSkeleton', () => ({ PageLoadingSkeleton: ({ title }: { title: string }) => <div>Loading {title}</div> }))

const mockSummary: SummaryResponse = {
  totalTests: 100, runCount: 5, avgDuration: 0.5, unstableCount: 3,
  outlierCount: 1, makespan: 10.5, speedupFactor: 4.8,
  balanceRatio: 0.95, sequentialDuration: 50.0, cpuCores: 8,
}
const mockTests: TestsResponse = {
  total: 1, limit: 100, offset: 0,
  tests: [{ testName: 'com.example.Test.m', runCount: 5, meanDuration: 1.0, stdDev: 0.1, min: 0.9, max: 1.1, coefficientOfVariation: 0.1, isOutlier: false, unstable: false, zeroDuration: false }],
}
const mockJobs: JobsResponse = { jobs: [{ jobId: 1, totalTime: 10.5, tests: ['com.example.Test.m'] }], metrics: {} }
const mockTrends: TrendsResponse = {
  trends: [
    { runAt: '2024-01-01T00:00:00Z', totalDuration: 50, averageDuration: 0.5, testCount: 100, criticalPath: 10, balanceRatio: 0.9 },
    { runAt: '2024-01-02T00:00:00Z', totalDuration: 52, averageDuration: 0.52, testCount: 100, criticalPath: 10.5, balanceRatio: 0.95 },
  ],
}

function setupApi(overrides: Record<string, Partial<ReturnType<typeof useApi>>> = {}) {
  vi.mocked(useApi).mockImplementation((url: string) => {
    const defaults: Record<string, ReturnType<typeof useApi>> = {
      '/api/summary': { data: mockSummary, loading: false, error: null },
      '/api/tests?sort=duration&limit=100': { data: mockTests, loading: false, error: null },
      '/api/tests?sort=cv&limit=500': { data: mockTests, loading: false, error: null },
      '/api/jobs': { data: mockJobs, loading: false, error: null },
      '/api/trends?limit=20': { data: mockTrends, loading: false, error: null },
    }
    return { ...defaults[url], ...overrides[url] } as ReturnType<typeof useApi>
  })
}

describe('Overview page', () => {
  beforeEach(() => { setupApi() })

  it('shows a loading skeleton while fetching', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: true, error: null })
    render(<Overview />)
    expect(screen.getByText(/Loading Overview/i)).toBeInTheDocument()
  })

  it('shows an error state when an API call fails', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: false, error: 'Network error' })
    render(<Overview />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('shows an error state when summary is null', () => {
    setupApi({ '/api/summary': { data: null, loading: false, error: null } })
    render(<Overview />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders the page title on success', () => {
    render(<Overview />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders the run count badge', () => {
    render(<Overview />)
    expect(screen.getByText('RUN 5')).toBeInTheDocument()
  })

  it('shows a regression banner when a regression is detected', () => {
    const regTrends: TrendsResponse = {
      trends: [
        { runAt: '2024-01-01T00:00:00Z', totalDuration: 50, averageDuration: 0.5, testCount: 100, criticalPath: 10, balanceRatio: 0.9 },
        { runAt: '2024-01-02T00:00:00Z', totalDuration: 50, averageDuration: 0.5, testCount: 100, criticalPath: 12, balanceRatio: 0.9 },
      ],
    }
    setupApi({ '/api/trends?limit=20': { data: regTrends, loading: false, error: null } })
    render(<Overview />)
    expect(screen.getByText(/REGRESSION DETECTED/i)).toBeInTheDocument()
  })

  it('does not show regression banner when trends are stable', () => {
    render(<Overview />)
    expect(screen.queryByText(/REGRESSION DETECTED/i)).toBeNull()
  })
})
