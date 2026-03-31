import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import type { SummaryResponse, JobsResponse } from '@/types/api'

//  Count-up animation 
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

//  Stat card 
function StatCard({
  label, value, format, sub, accent, active, delay, last,
}: {
  label: string; value: number; format: (v: number) => string; sub: string
  accent: string; active: boolean; delay: number; last?: boolean
}) {
  const animated = useCountUp(value, active, delay)
  return (
    <div
      className="flex flex-col justify-between p-5"
      style={{ borderRight: last ? 'none' : '1px solid var(--g4)', minWidth: 0, position: 'relative', overflow: 'hidden' }}
      role="group" aria-label={label}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--g6)', marginTop: 6 }}>
        {label}
      </span>
      <div className="metric-value" style={{ fontSize: '2.3rem', lineHeight: 1, color: 'var(--g7)', marginTop: 12 }}>
        {format(animated)}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', marginTop: '0.55rem' }}>
        {sub}
      </div>
    </div>
  )
}

//  Section header 
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

//  Scanlines 
function Scanlines() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.04) 3px, oklch(0 0 0 / 0.04) 4px)',
    }} />
  )
}

//  Chart tooltip 
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

//  Job chart panel 
function JobChartPanel({ jobs, makespan }: { jobs: { jobId: number; totalTime: number; tests: string[] }[]; makespan: number }) {
  const chartData = jobs.map(j => ({
    name: `Job ${j.jobId}`,
    Duration: parseFloat(j.totalTime.toFixed(3)),
    tests: j.tests.length,
  }))
  const maxTime = Math.max(...jobs.map(j => j.totalTime))

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--cyan)"
        title="Job Duration Comparison"
        right={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 2, background: 'var(--amber)', borderStyle: 'dashed', borderWidth: '0 0 1px 0' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)' }}>makespan</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{jobs.length} jobs · {jobs.reduce((a, j) => a + j.tests.length, 0)} tests</span>
          </div>
        }
      />
      <div style={{ flex: 1, padding: '12px 16px 8px 4px', position: 'relative' }}>
        <Scanlines />
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }}
              axisLine={{ stroke: 'var(--g4)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}s`}
            />
            <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.03)' }} />
            <ReferenceLine y={makespan} stroke="var(--amber)" strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: `${makespan.toFixed(2)}s`, position: 'insideTopRight', fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--amber)' }} />
            <Bar
              dataKey="Duration"
              radius={0}
              isAnimationActive
              animationDuration={800}
              fill="var(--cyan-dim)"
              stroke="var(--cyan)"
              strokeWidth={1}
              shape={(props: any) => {
                const isCritical = props.Duration === maxTime
                return (
                  <rect
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fill={isCritical ? 'var(--amber-dim)' : 'var(--cyan-dim)'}
                    stroke={isCritical ? 'var(--amber)' : 'var(--cyan)'}
                    strokeWidth={1}
                  />
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

//  Job detail list 
function JobBarsPanel({ jobs, makespan, balanceRatio }: { jobs: { jobId: number; totalTime: number; tests: string[] }[]; makespan: number; balanceRatio: number }) {
  const maxJobTime = Math.max(...jobs.map(j => j.totalTime), 1)

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--cyan)"
        title="Job Breakdown"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{Math.round(balanceRatio * 100)}% balance · {makespan.toFixed(2)}s makespan</span>}
      />
      <div className="flex flex-col flex-1 overflow-auto px-5 py-4 gap-4" role="list">
        {jobs.map((job, i) => {
          const isSlowest = job.totalTime === maxJobTime
          const pct = makespan > 0 ? (job.totalTime / makespan) * 100 : 0
          const color = isSlowest ? 'var(--amber)' : 'var(--cyan)'
          const colorDim = isSlowest ? 'var(--amber-dim)' : 'var(--cyan-dim)'

          return (
            <div key={job.jobId} role="listitem">
              <div className="flex items-center gap-3 mb-1.5">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', width: 40, flexShrink: 0, letterSpacing: '0.04em' }}>
                  JOB {job.jobId}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>
                  {job.tests.length} test{job.tests.length !== 1 ? 's' : ''}
                </span>
                {isSlowest && (
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.12em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 4px' }}>
                    CRITICAL
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.58rem', color, marginLeft: 'auto' }}>
                  {job.totalTime.toFixed(2)}s
                </span>
              </div>

              <div style={{ height: 24, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.55, delay: 0.08 * i, ease: 'easeOut' }}
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: colorDim, borderRight: `2px solid ${color}` }}
                  aria-hidden="true"
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.48rem',
                  color: 'var(--g7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                }}>
                  {job.tests.map(t => t.split('.').pop()).join(' · ')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

//  Main component 
export function Scheduling() {
  const [calibrated, setCalibrated] = useState(false)
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: jobsData, loading: jobsLoading, error: jobsError } = useApi<JobsResponse>('/api/jobs')

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

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

      {/*  Header  */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Scheduling</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--cyan)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> LPT Job Distribution</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>
            {jobs.length} parallel jobs
          </span>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ jobs, summary: { makespan: s.makespan, speedupFactor: s.speedupFactor, balanceRatio: s.balanceRatio, sequentialDuration: s.sequentialDuration, totalTests: s.totalTests }, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `testsplit-scheduling-${new Date().toISOString().slice(0, 10)}.json`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--g6)', background: 'transparent', border: '1px solid var(--g4)', padding: '2px 8px', cursor: 'pointer' }}
          >
            EXPORT
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', padding: '2px 8px' }}>
            {jobs.length} JOBS
          </span>
        </div>
      </header>

      {/*  Stat cards  */}
      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Scheduling metrics">
        <StatCard label="Makespan" value={s.makespan} format={v => `${v.toFixed(2)}s`} sub="critical path duration" accent="var(--cyan)" active={calibrated} delay={0} />
        <StatCard label="Speed-up" value={s.speedupFactor} format={v => `${v.toFixed(2)}×`} sub={`vs ${s.sequentialDuration.toFixed(2)}s sequential`} accent="var(--green)" active={calibrated} delay={100} />
        <StatCard label="Balance" value={s.balanceRatio * 100} format={v => `${v.toFixed(0)}%`} sub="load balance ratio" accent="var(--amber)" active={calibrated} delay={200} />
        <StatCard label="Parallel Jobs" value={jobs.length} format={v => String(Math.round(v))} sub={`${s.totalTests} tests distributed`} accent="var(--g5)" active={calibrated} delay={300} last />
      </section>

      {/*  Two-column body  */}
      {jobs.length > 0 && (
        <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

          {/* Left: bar chart */}
          <div className="flex flex-col" style={{ width: '45%', borderRight: '1px solid var(--g4)' }}>
            <JobChartPanel jobs={jobs} makespan={s.makespan} />
          </div>

          {/* Right: detailed breakdown */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <JobBarsPanel jobs={jobs} makespan={s.makespan} balanceRatio={s.balanceRatio} />
          </div>
        </div>
      )}
    </div>
  )
}
