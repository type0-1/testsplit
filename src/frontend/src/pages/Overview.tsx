import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import {
  MOCK_SUMMARY, MOCK_TRENDS, MOCK_JOBS, MOCK_TEST_STATS,
  TREND_KEYS, TREND_COLORS, TREND_KEY_LABELS,
} from '@/data/mockData'
import type { TrendKey } from '@/data/mockData'

/*
  TODO - extend both StatPanelProps and TooltipPayloadItem
  as we add more pages and move away from mock data.
*/

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
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--g5)', marginTop: '0.55rem', letterSpacing: '0.05em' }}>
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

// Instability panel (shows tests w/ high variation and outliers)
function InstabilityPanel() {
  const unstable = Object.values(MOCK_TEST_STATS).filter(t => t.unstable).sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation)

  return (
    <div className="flex flex-col h-full" style={{ borderLeft: '1px solid var(--g4)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div style={{ width: 2, height: 10, background: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          Instability
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--amber)', marginLeft: 'auto' }}>
          {unstable.length} flagged
        </span>
      </div>

      {/* Entries */}
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

              {/* Metrics row */}
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

              {/* Variance bar */}
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

// Display distribution + critical path based on LPT scheduling of jobs 

function JobDistributionPanel() {
  const makespan = MOCK_SUMMARY.makespan
  const maxTime = Math.max(...MOCK_JOBS.map(j => j.totalTime))

  return (
    <div style={{ borderTop: '1px solid var(--g4)', padding: '12px 16px 16px' }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div style={{ width: 2, height: 10, background: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          LPT Job Distribution
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', marginLeft: 'auto' }}>
          {MOCK_JOBS.length} parallel jobs · makespan {makespan.toFixed(2)}s ·{' '}
          {Math.round(MOCK_SUMMARY.balanceRatio * 100)}% balance
        </span>
      </div>

      {/* Bars */}
      <div className="flex flex-col gap-1.5" role="list">
        {MOCK_JOBS.map(job => {
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

// Overview Page (main content using the functions defined above)

export default function Overview() {
  const [calibrated, setCalibrated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

  const PANELS = [
    {
      label: 'Total Tests',
      value: MOCK_SUMMARY.totalTests,
      format: (v: number) => String(Math.round(v)),
      sub: `across ${MOCK_SUMMARY.runCount} profiling runs`,
      rail: 'var(--orange)',
      delay: 0,
    },
    {
      label: 'Seq. Duration',
      value: MOCK_SUMMARY.sequentialDuration,
      format: (v: number) => `${v.toFixed(1)}s`,
      sub: 'unparallelised total',
      rail: 'var(--g5)',
      delay: 120,
    },
    {
      label: 'Makespan',
      value: MOCK_SUMMARY.makespan,
      format: (v: number) => `${v.toFixed(2)}s`,
      sub: 'critical path · 4 jobs',
      rail: 'var(--cyan)',
      delay: 240,
    },
    {
      label: 'Speed-up',
      value: MOCK_SUMMARY.speedupFactor,
      format: (v: number) => `${v.toFixed(2)}×`,
      sub: `${MOCK_SUMMARY.unstableCount} unstable · ${MOCK_SUMMARY.outlierCount} outlier`,
      rail: 'var(--green)',
      delay: 360,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Overview">

      {/* Header */}
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
            Last run: 2026-01-19
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
            RUN 5 / 5
          </span>
        </div>
      </header>

      {/*  Stat panels + scanline */}
      <section className="relative shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Key metrics">
        {/* CI Scanline Calibration */}
        <motion.div
          aria-hidden="true"
          initial={{ top: 0, opacity: 1 }}
          animate={{ top: '100%', opacity: [1, 1, 0] }}
          transition={{ duration: 0.7, ease: 'linear', times: [0, 0.85, 1] }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, var(--orange) 20%, var(--orange) 80%, transparent 100%)',
            zIndex: 10,
            pointerEvents: 'none',
            boxShadow: '0 0 6px var(--orange)',
          }}
        />

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

      {/* Middle row: trend chart + instability  */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Duration trend chart */}
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
              top 5 tests - 5 runs
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
            {TREND_KEYS.map(k => (
              <div key={k} className="flex items-center gap-1.5">
                <div style={{ width: 12, height: 2, background: TREND_COLORS[k as TrendKey] }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)' }}>
                  {TREND_KEY_LABELS[k as TrendKey].split('.').pop()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 px-3 py-3" style={{ minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_TRENDS} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
                <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
                <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--g5)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                {TREND_KEYS.map(k => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={TREND_KEY_LABELS[k as TrendKey].split('.').pop()}
                    stroke={TREND_COLORS[k as TrendKey]}
                    strokeWidth={1.5}
                    dot={{ r: 2, fill: TREND_COLORS[k as TrendKey], strokeWidth: 0 }}
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

        {/* Instability panel */}
        <div className="w-[240px] shrink-0 overflow-hidden flex flex-col">
          <InstabilityPanel />
        </div>
      </div>

      {/* Job distribution  */}
      <div className="shrink-0">
        <JobDistributionPanel />
      </div>

    </div>
  )
}
