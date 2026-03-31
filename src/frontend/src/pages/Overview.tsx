import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import type { SummaryResponse, TestsResponse, JobsResponse, TrendsResponse, TestStat, TrendPoint } from '@/types/api'

// Animation countup
function useCountUp(target: number, active: boolean, delay = 0): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    let startTs: number | null = null
    const DURATION = 700
    let raf: number
    const step = (ts: number) => {
      if (startTs === null) startTs = ts + delay
      const elapsed = ts - startTs
      if (elapsed < 0) { raf = requestAnimationFrame(step); return }
      const p = Math.min(elapsed / DURATION, 1)
      setVal(target * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, delay])
  return val
}

// Stat card
function StatCard({
  label, value, format, sub, accent, active, delay, delta, last,
}: {
  label: string; value: number; format: (v: number) => string; sub: string
  accent: string; active: boolean; delay: number; delta?: number | null; last?: boolean
}) {
  const animated = useCountUp(value, active, delay)
  const sign = delta != null ? (delta > 0 ? '↑' : delta < 0 ? '↓' : '→') : null
  const deltaColor = delta != null ? (delta > 0.02 ? 'var(--orange)' : delta < -0.02 ? 'var(--green)' : 'var(--g6)') : null

  return (
    <div
      className="flex flex-col justify-between p-5"
      style={{ borderRight: last ? 'none' : '1px solid var(--g4)', minWidth: 0, position: 'relative', overflow: 'hidden' }}
      role="group" aria-label={label}
    >
      {/* top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />

      <div className="flex items-start justify-between gap-2 mb-3" style={{ marginTop: 6 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          {label}
        </span>
        {sign && delta != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: deltaColor!, background: `${deltaColor}22`, border: `1px solid ${deltaColor}`, padding: '1px 5px', flexShrink: 0 }}>
            {sign} {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="metric-value" style={{ fontSize: '2.3rem', lineHeight: 1, color: 'var(--g7)' }}>
        {format(animated)}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', marginTop: '0.55rem' }}>
        {sub}
      </div>
    </div>
  )
}

// Chart tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--g2)', border: '1px solid var(--g4)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.56rem' }}>
      <p style={{ color: 'var(--g6)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ marginBottom: 2 }}>
          <span style={{ color: 'var(--g6)' }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: p.color }}>{Number(p.value).toFixed(2)}s</span>
        </div>
      ))}
    </div>
  )
}

// Scanline overlay
function Scanlines() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.04) 3px, oklch(0 0 0 / 0.04) 4px)',
    }} />
  )
}

// Section header
function SectionHeader({ accent, title, right }: { accent: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
      <div style={{ width: 2, height: 10, background: accent, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--g6)' }}>
        {title}
      </span>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  )
}

// Job distribution
function JobDistributionPanel({ jobs, makespan, balanceRatio }: { jobs: { jobId: number; totalTime: number; tests: string[] }[]; makespan: number; balanceRatio: number }) {
  const maxTime = Math.max(...jobs.map(j => j.totalTime))
  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--cyan)"
        title="Job Distribution"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{Math.round(balanceRatio * 100)}% balance</span>}
      />
      <div className="flex flex-col flex-1 overflow-auto px-4 py-4 gap-4" role="list">
        {jobs.map(job => {
          const pct = makespan > 0 ? (job.totalTime / makespan) * 100 : 0
          const isSlowest = job.totalTime === maxTime
          const color = isSlowest ? 'var(--amber)' : 'var(--cyan)'
          const colorDim = isSlowest ? 'var(--amber-dim)' : 'var(--cyan-dim)'
          return (
            <div key={job.jobId} role="listitem">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)', letterSpacing: '0.06em' }}>JOB {job.jobId}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)' }}>{job.tests.length} tests</span>
                  {isSlowest && (
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.12em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 4px' }}>
                      CRITICAL
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.58rem', color }}>{job.totalTime.toFixed(2)}s</span>
              </div>
              <div style={{ height: 22, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + job.jobId * 0.08, ease: 'easeOut' }}
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: colorDim, borderRight: `2px solid ${color}` }}
                  aria-hidden="true"
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 8, fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none' }}>
                  {job.tests.map(t => t.split('.').pop()).join(' · ')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2.5 shrink-0 flex items-center justify-between" style={{ borderTop: '1px solid var(--g4)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>makespan</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--cyan)' }}>{makespan.toFixed(2)}s critical path</span>
      </div>
    </div>
  )
}

// Top 10 slowest tests
function SlowestTestsPanel({ tests }: { tests: TestStat[] }) {
  const sorted = [...tests].sort((a, b) => b.meanDuration - a.meanDuration).slice(0, 10)
  const max = sorted[0]?.meanDuration ?? 1

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--orange)"
        title="Slowest Tests"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>by mean duration</span>}
      />
      <div className="flex flex-col flex-1 overflow-auto">
        {sorted.map((t, i) => {
          const method = t.testName.split('.').pop() ?? t.testName
          const cls = t.testName.includes('.') ? t.testName.substring(0, t.testName.lastIndexOf('.')) : ''
          const pct = (t.meanDuration / max) * 100
          const color = t.isOutlier ? 'var(--orange)' : t.unstable ? 'var(--amber)' : 'var(--g6)'
          const colorDim = t.isOutlier ? 'var(--orange-dim)' : t.unstable ? 'var(--amber-dim)' : 'var(--g3)'

          return (
            <div key={t.testName} className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--g4)' }} title={t.testName}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)', flexShrink: 0, width: 14 }}>{i + 1}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--g7)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {method}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {t.isOutlier && (
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '1px 4px' }}>OUTLIER</span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.6rem', color, width: 52, textAlign: 'right' }}>
                    {t.meanDuration.toFixed(2)}s
                  </span>
                </div>
              </div>
              {cls && (
                <div className="flex items-center gap-2 mb-1.5" style={{ paddingLeft: 22 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{cls}</span>
                </div>
              )}
              <div style={{ paddingLeft: 22 }}>
                <div style={{ height: 4, background: 'var(--g3)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: 0.05 * i, ease: 'easeOut' }}
                    style={{ height: '100%', background: colorDim, borderRight: `2px solid ${color}` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Instability panel
function InstabilityPanel({ tests, totalTests }: { tests: TestStat[]; totalTests: number }) {
  const unstable = tests.filter(t => t.unstable).sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation)

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--amber)"
        title="Instability"
        right={
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--amber)' }}>
            {unstable.length} / {totalTests} flagged
          </span>
        }
      />
      {unstable.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--green)' }}>✓ no unstable tests detected</span>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-auto">
          {unstable.map((t, i) => {
            const method = t.testName.split('.').pop() ?? t.testName
            const cls = t.testName.includes('.') ? t.testName.substring(0, t.testName.lastIndexOf('.')) : ''
            const cvPct = Math.min(t.coefficientOfVariation * 100, 100)
            const hot = cvPct > 70

            return (
              <div key={t.testName} className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--g4)' }} title={t.testName}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--g7)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {method}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.isOutlier && (
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '1px 4px' }}>OUTLIER</span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.6rem', color: hot ? 'var(--orange)' : 'var(--amber)' }}>
                      {cvPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                {cls && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)', marginBottom: 6, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {cls}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>σ {t.stdDev.toFixed(2)}s</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>μ {t.meanDuration.toFixed(2)}s</span>
                  <div style={{ flex: 1, height: 3, background: 'var(--g3)', overflow: 'hidden', marginTop: 1 }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cvPct}%` }}
                      transition={{ duration: 0.5, delay: 0.04 * i, ease: 'easeOut' }}
                      style={{ height: '100%', background: hot ? 'var(--orange)' : 'var(--amber)' }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Regression detection
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

function formatRunLabel(runAt: string, index: number): string {
  try { return new Date(runAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) }
  catch { return `Run ${index + 1}` }
}

// Main component
export default function Overview() {
  const [calibrated, setCalibrated] = useState(false)
  const { data: summary, loading: sLoading, error: sError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: tLoading, error: tError } = useApi<TestsResponse>('/api/tests?sort=duration&limit=100')
  const { data: cvData, loading: cvLoading } = useApi<TestsResponse>('/api/tests?sort=cv&limit=500')
  const { data: jobsData, loading: jLoading, error: jError } = useApi<JobsResponse>('/api/jobs')
  const { data: trendsData, loading: trLoading, error: trError } = useApi<TrendsResponse>('/api/trends?limit=20')

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

  const isLoading = sLoading || tLoading || cvLoading || jLoading || trLoading
  const errorMessage = sError ?? tError ?? jError ?? trError

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
    : '—'
  const regression = detectRegression(rawTrends)

  const prevTrend = rawTrends.length >= 2 ? rawTrends[rawTrends.length - 2] : null
  const currTrend = rawTrends.length >= 1 ? rawTrends[rawTrends.length - 1] : null
  const delta = (curr: number, prev: number | undefined) => (!prev || prev === 0) ? null : (curr - prev) / prev

  // For small datasets (<3 points) show a bar chart instead of area
  const useBarChart = chartData.length < 3

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Overview">

      {/*  Header  */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Overview</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--orange)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> System Calibration</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>Last run: {lastRun}</span>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ summary: s, jobs, trends: rawTrends, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `testsplit-report-${new Date().toISOString().slice(0, 10)}.json`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--g6)', background: 'transparent', border: '1px solid var(--g4)', padding: '2px 8px', cursor: 'pointer' }}
          >
            EXPORT
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '2px 8px' }}>
            RUN {s.runCount}
          </span>
        </div>
      </header>

      {/*  Regression banner  */}
      {regression && (
        <div className="flex items-center gap-3 px-5 py-2 shrink-0" style={{ background: 'var(--orange-dim)', borderBottom: '1px solid var(--orange)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--orange)' }}>⚠ REGRESSION DETECTED</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g7)' }}>
            {regression.field} increased {(regression.pct * 100).toFixed(1)}% since last run
          </span>
        </div>
      )}

      {/*  Stat cards  */}
      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Key metrics">
        <StatCard label="Total Tests" value={s.totalTests} format={v => String(Math.round(v))} sub={`across ${s.runCount} profiling runs`} accent="var(--orange)" active={calibrated} delay={0} delta={currTrend && prevTrend ? delta(currTrend.testCount, prevTrend.testCount) : null} />
        <StatCard label="Seq. Duration" value={s.sequentialDuration} format={v => `${v.toFixed(1)}s`} sub="unparallelised total" accent="var(--g5)" active={calibrated} delay={100} delta={currTrend && prevTrend ? delta(currTrend.totalDuration, prevTrend.totalDuration) : null} />
        <StatCard label="Makespan" value={s.makespan} format={v => `${v.toFixed(2)}s`} sub={`critical path · ${jobs.length} jobs`} accent="var(--cyan)" active={calibrated} delay={200} delta={currTrend && prevTrend ? delta(currTrend.criticalPath, prevTrend.criticalPath) : null} />
        <StatCard label="Speed-up" value={s.speedupFactor} format={v => `${v.toFixed(2)}×`} sub={`${s.unstableCount} unstable · ${s.outlierCount} outliers`} accent="var(--green)" active={calibrated} delay={300} last />
      </section>

      {/*  Scrollable body  */}
      <div className="flex-1 overflow-auto">

        {/* Row 1: trend chart + job distribution */}
        <div className="flex" style={{ borderBottom: '1px solid var(--g4)', height: 300 }}>

          {/* Trend chart */}
          <div className="flex flex-col flex-1" style={{ minWidth: 0, borderRight: '1px solid var(--g4)', position: 'relative' }}>
            <SectionHeader
              accent="var(--orange)"
              title="Duration Trend"
              right={
                <div className="flex items-center gap-4">
                  {[{ label: 'Total', color: 'var(--orange)' }, { label: 'Makespan', color: 'var(--cyan)' }].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div style={{ width: 10, height: 2, background: l.color }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              }
            />
            <div className="flex-1" style={{ position: 'relative', padding: '8px 12px 8px 4px' }}>
              <Scanlines />
              <ResponsiveContainer width="100%" height="100%">
                {useBarChart ? (
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
                    <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
                    <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.03)' }} />
                    <Bar dataKey="Total" fill="var(--orange-dim)" stroke="var(--orange)" strokeWidth={1} radius={0} />
                    <Bar dataKey="Makespan" fill="var(--cyan-dim)" stroke="var(--cyan)" strokeWidth={1} radius={0} />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--orange)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--orange)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMakespan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
                    <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
                    <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--g4)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="Total" stroke="var(--orange)" strokeWidth={1.5} fill="url(#gTotal)" dot={{ r: 3, fill: 'var(--orange)', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
                    <Area type="monotone" dataKey="Makespan" stroke="var(--cyan)" strokeWidth={1.5} fill="url(#gMakespan)" dot={{ r: 3, fill: 'var(--cyan)', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Job sidebar */}
          {jobs.length > 0 && (
            <div className="shrink-0 flex flex-col" style={{ width: 310 }}>
              <JobDistributionPanel jobs={jobs} makespan={s.makespan} balanceRatio={s.balanceRatio} />
            </div>
          )}
        </div>

        {/* Row 2: slowest tests + instability: fills the remaining space */}
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
