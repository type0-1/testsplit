import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Scheduling } from '../../src/pages/Scheduling'
import { useApi } from '../../src/hooks/useApi'
import type { SummaryResponse, JobsResponse } from '../../src/types/api'

vi.mock('../../src/hooks/useApi')
vi.mock('../../src/hooks/useCalibration', () => ({ useCalibration: () => true }))
vi.mock('../../src/hooks/useCountUp', () => ({ useCountUp: (t: number) => t }))
vi.mock('../../src/components/scheduling/CoreUtilisationPanel', () => ({ CoreUtilizationPanel: () => <div data-testid="core-util" /> }))
vi.mock('../../src/components/scheduling/JobChartPanel', () => ({ JobChartPanel: () => <div data-testid="job-chart" /> }))
vi.mock('../../src/components/scheduling/JobBarsPanel', () => ({ JobBarsPanel: () => <div data-testid="job-bars" /> }))
vi.mock('../../src/components/PageLoadingSkeleton', () => ({ PageLoadingSkeleton: ({ title }: { title: string }) => <div>Loading {title}</div> }))

const mockSummary: SummaryResponse = {
  totalTests: 50, runCount: 2, avgDuration: 0.4, unstableCount: 2,
  outlierCount: 0, makespan: 8.0, speedupFactor: 3.1,
  balanceRatio: 0.92, sequentialDuration: 24.0, cpuCores: 4,
}
const mockJobs: JobsResponse = {
  jobs: [
    { jobId: 1, totalTime: 8.0, tests: ['com.example.A'] },
    { jobId: 2, totalTime: 7.8, tests: ['com.example.B'] },
    { jobId: 3, totalTime: 7.5, tests: ['com.example.C'] },
  ],
  metrics: { balanceRatio: 0.92 },
}

function setupApi(overrides: Record<string, Partial<ReturnType<typeof useApi>>> = {}) {
  vi.mocked(useApi).mockImplementation((url: string) => {
    const defaults: Record<string, ReturnType<typeof useApi>> = {
      '/api/summary': { data: mockSummary, loading: false, error: null },
      '/api/jobs': { data: mockJobs, loading: false, error: null },
    }
    return { ...defaults[url], ...overrides[url] } as ReturnType<typeof useApi>
  })
}

describe('Scheduling page', () => {
  beforeEach(() => { setupApi() })

  it('shows a loading skeleton while fetching', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: true, error: null })
    render(<Scheduling />)
    expect(screen.getByText(/Loading Scheduling/i)).toBeInTheDocument()
  })

  it('shows an error state when an API call fails', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: false, error: 'Failed to fetch' })
    render(<Scheduling />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  it('renders the page title on success', () => {
    render(<Scheduling />)
    expect(screen.getByText('Scheduling')).toBeInTheDocument()
  })

  it('renders the job count badge', () => {
    render(<Scheduling />)
    expect(screen.getByText('3 JOBS')).toBeInTheDocument()
  })

  it('renders the job count in the header', () => {
    render(<Scheduling />)
    expect(screen.getByText('3 parallel jobs')).toBeInTheDocument()
  })

  it('shows an error when jobs data is null', () => {
    setupApi({ '/api/jobs': { data: null, loading: false, error: null } })
    render(<Scheduling />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
