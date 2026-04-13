import { motion } from 'motion/react'
import { SectionHeader } from '@/components/SectionHeader'
import { testMethodName } from '@/lib/testName'
import type { Job } from '@/types/api'

export function JobBarsPanel({ jobs, makespan, balanceRatio }: { jobs: Job[]; makespan: number; balanceRatio: number }) {
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
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', paddingLeft: 10,
                  fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g7)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none',
                }}>
                  {job.tests.map(t => testMethodName(t)).join(' · ')}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
