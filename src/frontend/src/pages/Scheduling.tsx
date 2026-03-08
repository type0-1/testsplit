import { motion } from 'motion/react'
import { MOCK_SUMMARY, MOCK_JOBS } from '@/data/mockData'

const MAX_JOB_TIME = Math.max(...MOCK_JOBS.map(j => j.totalTime))

function JobBarsPanel() {
  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div style={{ width: 2, height: 10, background: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          Job Distribution
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', marginLeft: 'auto' }}>
          makespan {MOCK_SUMMARY.makespan.toFixed(2)}s · {Math.round(MOCK_SUMMARY.balanceRatio * 100)}% balance
        </span>
      </div>

      <div className="flex flex-col gap-3 px-5 py-5" role="list">
        {MOCK_JOBS.map((job, i) => {
          const isSlowest = job.totalTime === MAX_JOB_TIME
          const pct = (job.totalTime / MOCK_SUMMARY.makespan) * 100
          const color = isSlowest ? 'var(--amber)' : 'var(--cyan)'
          const colorDim = isSlowest ? 'var(--amber-dim)' : 'var(--cyan-dim)'

          return (
            <div key={job.jobId} role="listitem">
              <div className="flex items-center gap-3 mb-1.5">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', width: 40, flexShrink: 0, letterSpacing: '0.04em' }}>
                  JOB {job.jobId}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)' }}>
                  {job.tests.length} test{job.tests.length !== 1 ? 's' : ''}
                </span>
                {isSlowest && (
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.46rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 5px' }}>
                    CRITICAL
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.6rem', color, marginLeft: 'auto' }}>
                  {job.totalTime.toFixed(2)}s
                </span>
              </div>

              <div style={{ height: 28, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.55, delay: 0.1 * i, ease: 'easeOut' }}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Scheduling() {
  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Scheduling">
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Scheduling</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--cyan)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> LPT Job Distribution</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>Last run: 2026-01-19</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', padding: '2px 7px' }}>
            {MOCK_JOBS.length} JOBS
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        {[
          { label: 'Makespan', value: `${MOCK_SUMMARY.makespan.toFixed(2)}s`, sub: 'critical path duration', rail: 'var(--cyan)' },
          { label: 'Speed-up', value: `${MOCK_SUMMARY.speedupFactor.toFixed(2)}×`, sub: `vs ${MOCK_SUMMARY.sequentialDuration.toFixed(2)}s sequential`, rail: 'var(--green)' },
          { label: 'Balance', value: `${Math.round(MOCK_SUMMARY.balanceRatio * 100)}%`, sub: 'load balance ratio', rail: 'var(--amber)' },
          { label: 'Parallel Jobs', value: `${MOCK_JOBS.length}`, sub: `${MOCK_SUMMARY.totalTests} tests distributed`, rail: 'var(--g5)' },
        ].map((p, i, arr) => (
          <div key={p.label} className="flex flex-col justify-between p-4" style={{ borderRight: i === arr.length - 1 ? 'none' : '1px solid var(--g4)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 2, height: 11, background: p.rail, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--g6)' }}>{p.label}</span>
            </div>
            <div className="metric-value" style={{ fontSize: '2.1rem', lineHeight: 1, color: 'var(--g7)' }}>{p.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--g6)', marginTop: '0.55rem', letterSpacing: '0.05em' }}>{p.sub}</div>
          </div>
        ))}
      </section>

      <JobBarsPanel />
    </div>
  )
}
