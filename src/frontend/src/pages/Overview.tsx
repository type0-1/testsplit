import { useApi } from '@/hooks/useApi'
import { useCalibration } from '@/hooks/useCalibration'

import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import { StatCard } from '@/components/StatCard'
import { JobDistributionPanel } from '@/components/overview/JobDistributionPanel'
import { SlowestTestsPanel } from '@/components/overview/SlowestTestsPanel'
import { InstabilityPanel } from '@/components/overview/InstabilityPanel'
import { TrendChartPanel } from '@/components/overview/TrendChartPanel'
import { PageHeader } from '@/components/PageHeader'
import { ExportButton } from '@/components/ExportButton'
import { pctDelta, formatRunLabel, downloadJson } from '@/lib/utils'
import type { SummaryResponse, TestsResponse, JobsResponse, TrendsResponse, TrendPoint } from '@/types/api'

function detectRegression(trends: TrendPoint[]): { field: string; pct: number } | null {
  if (trends.length < 2) return null
  const prev = trends[trends.length - 2]
  const curr = trends[trends.length - 1]
  for (const c of [
    { field: 'makespan', prev: prev.criticalPath, curr: curr.criticalPath },
    { field: 'total duration', prev: prev.totalDuration, curr: curr.totalDuration },
  ]) {
    if (c.prev > 0 && (c.curr - c.prev) / c.prev > 0.10) return { field: c.field, pct: (c.curr - c.prev) / c.prev }
  }
  return null
}

export default function Overview() {
  const calibrated = useCalibration()
  const { data: summary, loading: sLoading, error: sError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: tLoading, error: tError } = useApi<TestsResponse>('/api/tests?sort=duration&limit=100')
  const { data: cvData, loading: cvLoading, error: cvError } = useApi<TestsResponse>('/api/tests?sort=cv&limit=500')
  const { data: jobsData, loading: jLoading, error: jError } = useApi<JobsResponse>('/api/jobs')
  const { data: trendsData, loading: trLoading, error: trError } = useApi<TrendsResponse>('/api/trends?limit=20')

  const isLoading = sLoading || tLoading || cvLoading || jLoading || trLoading
  const errorMessage = sError ?? tError ?? cvError ?? jError ?? trError

  if (isLoading) return <PageLoadingSkeleton title="Overview" accentColor="var(--orange)" />
  if (errorMessage) return <PageErrorState title="Overview" error={errorMessage} />
  if (!summary) return <PageErrorState title="Overview" error="No profiling data found. Run: testsplit profile --junit <path>" />
  if (!testsData) return <PageErrorState title="Overview" error="No profiling data found." />
  if (!jobsData) return <PageErrorState title="Overview" error="No distribution data found." />

  const s = summary
  const tests = testsData.tests
  const jobs = jobsData.jobs
  const rawTrends = trendsData?.trends ?? []

  const chartData = rawTrends.map((t: TrendPoint, i: number) => ({
    run: formatRunLabel(t.runAt, i),
    Total: parseFloat(t.totalDuration.toFixed(2)),
    Makespan: parseFloat(t.criticalPath.toFixed(2)),
  }))

  const lastRun = rawTrends.length > 0
    ? new Date(rawTrends[rawTrends.length - 1].runAt).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '-'
  const regression = detectRegression(rawTrends)

  const prevTrend = rawTrends.length >= 2 ? rawTrends[rawTrends.length - 2] : null
  const currTrend = rawTrends.length >= 1 ? rawTrends[rawTrends.length - 1] : null

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Overview">

      <PageHeader
        title="Overview"
        accent="var(--orange)"
        subtitle="System Calibration"
        right={<>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>Last run: {lastRun}</span>
          <ExportButton onClick={() => downloadJson(`testsplit-report-${new Date().toISOString().slice(0, 10)}.json`, { summary: s, jobs, trends: rawTrends, exportedAt: new Date().toISOString() })} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '2px 8px' }}>RUN {s.runCount}</span>
        </>}
      />

      {regression && (
        <div className="flex items-center gap-3 px-5 py-2 shrink-0" style={{ background: 'var(--orange-dim)', borderBottom: '1px solid var(--orange)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--orange)' }}>⚠ REGRESSION DETECTED</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g7)' }}>
            {regression.field} increased {(regression.pct * 100).toFixed(1)}% since last run
          </span>
        </div>
      )}

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Key metrics">
        <StatCard label="Total Tests" value={s.totalTests} format={v => String(Math.round(v))} sub={`across ${s.runCount} profiling runs`} accent="var(--orange)" active={calibrated} delay={0} delta={currTrend && prevTrend ? pctDelta(currTrend.testCount, prevTrend.testCount) : null} />
        <StatCard label="Seq. Duration" value={s.sequentialDuration} format={v => `${v.toFixed(1)}s`} sub="unparallelised total" accent="var(--g5)" active={calibrated} delay={100} delta={currTrend && prevTrend ? pctDelta(currTrend.totalDuration, prevTrend.totalDuration) : null} />
        <StatCard label="Makespan" value={s.makespan} format={v => `${v.toFixed(2)}s`} sub={`critical path · ${jobs.length} jobs`} accent="var(--cyan)" active={calibrated} delay={200} delta={currTrend && prevTrend ? pctDelta(currTrend.criticalPath, prevTrend.criticalPath) : null} />
        <StatCard label="Speed-up" value={s.speedupFactor} format={v => `${v.toFixed(2)}×`} sub={`${s.unstableCount} unstable · ${s.outlierCount} outliers`} accent="var(--green)" active={calibrated} delay={300} last />
      </section>

      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ borderBottom: '1px solid var(--g4)', height: 300 }}>
          <TrendChartPanel chartData={chartData} />
          {jobs.length > 0 && (
            <div className="shrink-0 flex flex-col" style={{ width: 310 }}>
              <JobDistributionPanel jobs={jobs} makespan={s.makespan} balanceRatio={s.balanceRatio} />
            </div>
          )}
        </div>

        <div className="flex" style={{ minHeight: 320 }}>
          <div className="flex flex-col flex-1" style={{ borderRight: '1px solid var(--g4)', minWidth: 0 }}>
            <SlowestTestsPanel tests={tests} />
          </div>
          <div className="flex flex-col shrink-0" style={{ width: 380 }}>
            <InstabilityPanel tests={cvData?.tests ?? tests} totalTests={s.totalTests} />
          </div>
        </div>
      </div>
    </div>
  )
}
