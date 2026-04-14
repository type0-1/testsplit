import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Durations } from '../../src/pages/Durations'
import { useApi } from '../../src/hooks/useApi'
import type { SummaryResponse, TestsResponse } from '../../src/types/api'

vi.mock('../../src/hooks/useApi')
vi.mock('../../src/hooks/useCalibration', () => ({ useCalibration: () => true }))
vi.mock('../../src/hooks/useCountUp', () => ({ useCountUp: (t: number) => t }))
vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div> },
}))
vi.mock('../../src/components/durations/HistogramPanel', () => ({ HistogramPanel: () => <div data-testid="histogram" /> }))
vi.mock('../../src/components/PageLoadingSkeleton', () => ({ PageLoadingSkeleton: ({ title }: { title: string }) => <div>Loading {title}</div> }))

const mockSummary: SummaryResponse = {
  totalTests: 2, runCount: 3, avgDuration: 0.8, unstableCount: 1,
  outlierCount: 0, makespan: 5.0, speedupFactor: 2.5,
  balanceRatio: 0.9, sequentialDuration: 12.0, cpuCores: 4,
}
const mockTests: TestsResponse = {
  total: 2, limit: 500, offset: 0,
  tests: [
    { testName: 'com.example.SlowTest.run', runCount: 3, meanDuration: 1.5, stdDev: 0.1, min: 1.4, max: 1.6, coefficientOfVariation: 0.07, isOutlier: false, unstable: false, zeroDuration: false },
    { testName: 'com.example.FastTest.run', runCount: 3, meanDuration: 0.1, stdDev: 0.01, min: 0.09, max: 0.11, coefficientOfVariation: 0.1, isOutlier: false, unstable: true, zeroDuration: false },
  ],
}

function setupApi(overrides: Record<string, Partial<ReturnType<typeof useApi>>> = {}) {
  vi.mocked(useApi).mockImplementation((url: string) => {
    const defaults: Record<string, ReturnType<typeof useApi>> = {
      '/api/summary': { data: mockSummary, loading: false, error: null },
      '/api/tests?sort=duration&limit=500': { data: mockTests, loading: false, error: null },
    }
    return { ...defaults[url], ...overrides[url] } as ReturnType<typeof useApi>
  })
}

describe('Durations page', () => {
  beforeEach(() => { setupApi() })

  it('shows a loading skeleton while fetching', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: true, error: null })
    render(<Durations />)
    expect(screen.getByText(/Loading Durations/i)).toBeInTheDocument()
  })

  it('shows an error state when an API call fails', () => {
    vi.mocked(useApi).mockReturnValue({ data: null, loading: false, error: 'Server error' })
    render(<Durations />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Server error')).toBeInTheDocument()
  })

  it('renders the page title on success', () => {
    render(<Durations />)
    expect(screen.getByText('Durations')).toBeInTheDocument()
  })

  it('renders a row for each test', () => {
    render(<Durations />)
    expect(screen.getByTitle('com.example.SlowTest.run')).toBeInTheDocument()
    expect(screen.getByTitle('com.example.FastTest.run')).toBeInTheDocument()
  })

  it('renders the sort buttons', () => {
    render(<Durations />)
    expect(screen.getByRole('button', { name: /duration/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cv/i })).toBeInTheDocument()
  })

  it('toggles sort direction when the active sort button is clicked', async () => {
    render(<Durations />)
    const durationBtn = screen.getByRole('button', { name: /duration ↓/i })
    await userEvent.click(durationBtn)
    expect(screen.getByRole('button', { name: /duration ↑/i })).toBeInTheDocument()
  })

  it('changes sort key when a different sort button is clicked', async () => {
    render(<Durations />)
    await userEvent.click(screen.getByRole('button', { name: /^name/i }))
    expect(screen.getByRole('button', { name: /name ↓/i })).toBeInTheDocument()
  })
})
