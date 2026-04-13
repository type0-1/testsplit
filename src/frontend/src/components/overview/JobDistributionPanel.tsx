import { motion } from 'motion/react'
import { SectionHeader } from '@/components/SectionHeader'

interface Job { jobId: number; totalTime: number; tests: string[] }

export function JobDistributionPanel({ jobs, makespan, balanceRatio }: { jobs: Job[]; makespan: number; balanceRatio: number }) {
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
