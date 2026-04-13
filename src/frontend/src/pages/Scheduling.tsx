import { useApi } from '@/hooks/useApi'
import { useCalibration } from '@/hooks/useCalibration'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import { StatCard } from '@/components/StatCard'
import { CoreUtilizationPanel } from '@/components/scheduling/CoreUtilisationPanel'
import { JobChartPanel } from '@/components/scheduling/JobChartPanel'
import { JobBarsPanel } from '@/components/scheduling/JobBarsPanel'
import { ExportButton } from '@/components/ExportButton'
import { downloadJson } from '@/lib/utils'
import type { SummaryResponse, JobsResponse } from '@/types/api'

export function Scheduling() {
  const calibrated = useCalibration()
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: jobsData, loading: jobsLoading, error: jobsError } = useApi<JobsResponse>('/api/jobs')

  const isLoading = summaryLoading || jobsLoading
  const errorMessage = summaryError ?? jobsError

  if (isLoading) return <PageLoadingSkeleton title="Scheduling" accentColor="var(--cyan)" />
  if (errorMessage) return <PageErrorState title="Scheduling" error={errorMessage} />
  if (!summary) return <PageErrorState title="Scheduling" error={summaryError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />
  if (!jobsData) return <PageErrorState title="Scheduling" error={jobsError ?? 'No distribution data found. Run: testsplit profile --junit <path>'} />

  const s = summary
  const jobs = jobsData.jobs

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Scheduling">

      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Scheduling</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--cyan)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> LPT Job Distribution</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>{jobs.length} parallel jobs</span>
          <ExportButton onClick={() => downloadJson(`testsplit-scheduling-${new Date().toISOString().slice(0, 10)}.json`, { jobs, summary: { makespan: s.makespan, speedupFactor: s.speedupFactor, balanceRatio: s.balanceRatio, sequentialDuration: s.sequentialDuration, totalTests: s.totalTests }, exportedAt: new Date().toISOString() })} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', padding: '2px 8px' }}>
            {jobs.length} JOBS
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Scheduling metrics">
        <StatCard label="Makespan" value={s.makespan} format={v => `${v.toFixed(2)}s`} sub="critical path duration" accent="var(--cyan)" active={calibrated} delay={0} />
        <StatCard label="Speed-up" value={s.speedupFactor} format={v => `${v.toFixed(2)}×`} sub={`vs ${s.sequentialDuration.toFixed(2)}s sequential`} accent="var(--green)" active={calibrated} delay={100} />
        <StatCard label="Balance" value={s.balanceRatio * 100} format={v => `${v.toFixed(0)}%`} sub="load balance ratio" accent="var(--amber)" active={calibrated} delay={200} />
        <StatCard label="Cores Used" value={jobs.length} format={v => String(Math.round(v))} sub={`of ${s.cpuCores ?? '?'} available · ${s.totalTests} tests`} accent="var(--cyan)" active={calibrated} delay={300} last />
      </section>

      {jobs.length > 0 && (
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          <div className="flex flex-col" style={{ width: '45%', borderRight: '1px solid var(--g4)' }}>
            <CoreUtilizationPanel coresUsed={jobs.length} totalCores={s.cpuCores} />
            <div className="flex flex-col flex-1 overflow-hidden">
              <JobChartPanel jobs={jobs} makespan={s.makespan} />
            </div>
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <JobBarsPanel jobs={jobs} makespan={s.makespan} balanceRatio={s.balanceRatio} />
          </div>
        </div>
      )}
    </div>
  )
}
