import { motion } from 'motion/react'
import { SectionHeader } from '@/components/SectionHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { testStatusColor, testStatusColorDim } from '@/lib/testStatus'
import { testMethodName, testClassName } from '@/lib/testName'
import type { TestStat } from '@/types/api'

export function SlowestTestsPanel({ tests }: { tests: TestStat[] }) {
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
          const method = testMethodName(t.testName)
          const cls = testClassName(t.testName)
          const pct = (t.meanDuration / max) * 100
          const color = testStatusColor(t, 'var(--g6)')
          const colorDim = testStatusColorDim(t, 'var(--g3)')

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
                  {t.isOutlier && <StatusBadge status="outlier" />}
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
