import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import type { SummaryResponse, TestsResponse, JobsResponse, TrendsResponse, TestStat, TrendPoint } from '@/types/api'

function useCountUp(target: number, active: boolean, delay = 0): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    let startTs: number | null = null
    const DURATION = 650
    let raf: number
    const step = (ts: number) => {
      if (startTs === null) startTs = ts + delay
      const elapsed = ts - startTs
      if (elapsed < 0) { raf = requestAnimationFrame(step); return }
      const p = Math.min(elapsed / DURATION, 1)
      const eased = 1 - (1 - p) ** 3
      setVal(target * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, delay])
  return val
}

interface StatPanelProps {
  label: string
  value: number
  format: (v: number) => string
  sub: string
  rail: string
  active: boolean
  delay: number
  last?: boolean
}

function StatPanel({ label, value, format, sub, rail, active, delay, last }: StatPanelProps) {
  const animated = useCountUp(value, active, delay)
  return (
    <div className="flex flex-col justify-between p-4" style={{ borderRight: last ? 'none' : '1px solid var(--g4)', minWidth: 0 }} role="group" aria-label={label}>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ width: 2, height: 11, background: rail, flexShrink: 0 }} aria-hidden="true" />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '0.57rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--g6)',
        }}>
          {label}
        </span>
      </div>
      <div className="metric-value" aria-live="polite" style={{ fontSize: '2.1rem', lineHeight: 1, color: 'var(--g7)' }}>
        {format(animated)}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--g6)', marginTop: '0.55rem', letterSpacing: '0.05em' }}>
        {sub}
      </div>
    </div>
  )
}

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--g2)', border: '1px solid var(--g4)', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
      <p style={{ color: 'var(--g6)', marginBottom: 6, letterSpacing: '0.06em' }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color, marginBottom: 2 }}>
          <span style={{ color: 'var(--g6)' }}>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{p.value.toFixed(2)}s</span>
        </div>
      ))}
    </div>
  )
}

function InstabilityPanel({ tests }: { tests: TestStat[] }) {
  const unstable = tests.filter(t => t.unstable).sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation)

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid var(--g4)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div style={{ width: 2, height: 10, background: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          Instability
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--amber)', marginLeft: 'auto' }}>
          {unstable.length} flagged
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {unstable.map(t => {
          const method = t.testName.split('.').pop() ?? t.testName
          const cls = t.testName.includes('.') ? t.testName.substring(0, t.testName.lastIndexOf('.')) : ''
          return (
            <div key={t.testName} className="px-4 py-3" style={{ borderBottom: '1px solid var(--g4)' }}>
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', wordBreak: 'break-all', lineHeight: 1.4 }}>
                  {method}
                </span>
                {t.isOutlier && (
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: '0.48rem',
                    letterSpacing: '0.1em',
                    color: 'var(--orange)',
                    background: 'var(--orange-dim)',
                    border: '1px solid var(--orange)',
                    padding: '1px 5px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    OUTLIER
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.53rem', color: 'var(--g6)', marginBottom: '0.4rem' }}>
                {cls}
              </div>

              <div className="flex items-center gap-3">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--amber)' }}>
                  CV {(t.coefficientOfVariation * 100).toFixed(0)}%
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>
                  σ {t.stdDev.toFixed(2)}s
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>
                  μ {t.meanDuration.toFixed(2)}s
                </span>
              </div>

              <div style={{ height: 2, background: 'var(--g3)', marginTop: '0.45rem', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(t.coefficientOfVariation * 100, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{ height: '100%', background: t.coefficientOfVariation > 0.7 ? 'var(--orange)' : 'var(--amber)' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function JobDistributionPanel({ jobs, makespan, balanceRatio }: { jobs: { jobId: number; totalTime: number; tests: string[] }[]; makespan: number; balanceRatio: number }) {
  const maxTime = Math.max(...jobs.map(j => j.totalTime))

  return (
    <div style={{ borderTop: '1px solid var(--g4)', padding: '12px 16px 16px' }}>
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 2, height: 10, background: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          LPT Job Distribution
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', marginLeft: 'auto' }}>
          {jobs.length} parallel jobs · makespan {makespan.toFixed(2)}s ·{' '}
          {Math.round(balanceRatio * 100)}% balance
        </span>
      </div>

      <div className="flex flex-col gap-1.5" role="list">
        {jobs.map(job => {
          const pct = (job.totalTime / makespan) * 100
          const isSlowest = job.totalTime === maxTime
          return (
            <div key={job.jobId} className="flex items-center gap-3" role="listitem">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', width: 36, flexShrink: 0, letterSpacing: '0.04em' }}>
                JOB {job.jobId}
              </span>

              <div style={{ flex: 1, height: 20, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.55, delay: 0.2 + job.jobId * 0.07, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    background: isSlowest ? 'var(--amber-dim)' : 'var(--cyan-dim)',
                    borderRight: `2px solid ${isSlowest ? 'var(--amber)' : 'var(--cyan)'}`,
                  }}
                  aria-hidden="true"
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.52rem',
                  color: 'var(--g7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                }}>
                  {job.tests.map(t => t.split('.').pop()).join(' · ')}
                </div>
              </div>

              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: '0.6rem',
                color: isSlowest ? 'var(--amber)' : 'var(--g7)',
                width: 42,
                textAlign: 'right',
                flexShrink: 0,
              }}>
                {job.totalTime.toFixed(2)}s
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TREND_LINES = [
  { key: 'totalDuration', label: 'Total', color: 'var(--orange)' },
  { key: 'averageDuration', label: 'Average', color: 'var(--cyan)' },
] as const

function formatRunLabel(runAt: string, index: number): string {
  try {
    return new Date(runAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  } catch {
    return `Run ${index + 1}`
  }
}

export default function Overview() {
  const [calibrated, setCalibrated] = useState(false)
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading, error: testsError } = useApi<TestsResponse>('/api/tests?sort=cv&limit=100')
  const { data: jobsData, loading: jobsLoading, error: jobsError } = useApi<JobsResponse>('/api/jobs')
  const { data: trendsData, loading: trendsLoading, error: trendsError } = useApi<TrendsResponse>('/api/trends?limit=20')

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

  const isLoading = summaryLoading || testsLoading || jobsLoading || trendsLoading
  const errorMessage = summaryError ?? testsError ?? jobsError ?? trendsError

  if (isLoading) {
    return <PageLoadingSkeleton title="Overview" accentColor="var(--orange)" />
  }

  if (errorMessage) {
    return <PageErrorState title="Overview" error={errorMessage} />
  }

  if (!summary) return <PageErrorState title="Overview" error={summaryError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />
  if (!testsData) return <PageErrorState title="Overview" error={testsError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />
  if (!jobsData) return <PageErrorState title="Overview" error={jobsError ?? 'No distribution data found. Run: testsplit profile --junit <path>'} />

  const s = summary
  const tests = testsData.tests
  const jobs = jobsData.jobs
  const rawTrends = trendsData?.trends ?? []
  const chartData = rawTrends.map((t: TrendPoint, i: number) => ({
    run: formatRunLabel(t.runAt, i),
    totalDuration: parseFloat(t.totalDuration.toFixed(2)),
    averageDuration: parseFloat(t.averageDuration.toFixed(3)),
  }))

  const lastRun = rawTrends.length > 0 ? new Date(rawTrends[rawTrends.length - 1].runAt).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—'

  const PANELS = [
    {
      label: 'Total Tests',
      value: s.totalTests,
      format: (v: number) => String(Math.round(v)),
      sub: `across ${s.runCount} profiling runs`,
      rail: 'var(--orange)',
      delay: 0,
    },
    {
      label: 'Seq. Duration',
      value: s.sequentialDuration,
      format: (v: number) => `${v.toFixed(1)}s`,
      sub: 'unparallelised total',
      rail: 'var(--g5)',
      delay: 120,
    },
    {
      label: 'Makespan',
      value: s.makespan,
      format: (v: number) => `${v.toFixed(2)}s`,
      sub: `critical path · ${jobs.length} jobs`,
      rail: 'var(--cyan)',
      delay: 240,
    },
    {
      label: 'Speed-up',
      value: s.speedupFactor,
      format: (v: number) => `${v.toFixed(2)}×`,
      sub: `${s.unstableCount} unstable · ${s.outlierCount} outlier`,
      rail: 'var(--green)',
      delay: 360,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Overview">

      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--g7)',
          }}>
            Overview
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--orange)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> System Calibration</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>
            Last run: {lastRun}
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.52rem',
            letterSpacing: '0.1em',
            color: 'var(--orange)',
            background: 'var(--orange-dim)',
            border: '1px solid var(--orange)',
            padding: '2px 7px',
          }}>
            RUN {s.runCount}
          </span>
        </div>
      </header>

      <section className="relative shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Key metrics">
        <div className="grid grid-cols-4">
          {PANELS.map((p, i) => (
            <StatPanel
              key={p.label}
              {...p}
              active={calibrated}
              last={i === PANELS.length - 1}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
            <div style={{ width: 2, height: 10, background: 'var(--orange)', flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.57rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--g6)',
            }}>
              Duration Trend
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', marginLeft: 'auto' }}>
              total & avg · last {chartData.length} runs
            </span>
          </div>

          <div className="flex items-center gap-4 px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
            {TREND_LINES.map(l => (
              <div key={l.key} className="flex items-center gap-1.5">
                <div style={{ width: 12, height: 2, background: l.color }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)' }}>
                  {l.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 px-3 py-3" style={{ minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
                <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
                <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--g5)', strokeWidth: 1, strokeDasharray: '3 3' }} />
               {TREND_LINES.map(l => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    name={l.label}
                    stroke={l.color}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: l .color, strokeWidth: 0 }}
                    activeDot={{ r: 3.5, strokeWidth: 0 }}
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-[240px] shrink-0 overflow-hidden flex flex-col">
          <InstabilityPanel tests={tests} />
        </div>
      </div>

      <div className="shrink-0">
        {jobs.length > 0 && (
          <JobDistributionPanel jobs={jobs} makespan={s.makespan} balanceRatio={s.balanceRatio} />
        )}
      </div>

    </div>
  )
}
