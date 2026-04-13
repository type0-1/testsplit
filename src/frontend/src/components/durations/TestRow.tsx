import { motion } from 'motion/react'
import { testStatusColor, testStatusColorDim } from '@/lib/testStatus'
import { testMethodName, testClassName } from '@/lib/testName'
import { StatusBadge } from '@/components/StatusBadge'
import type { TestStat } from '@/types/api'

export function TestRow({ test, index, maxDuration }: { test: TestStat; index: number; maxDuration: number }) {
  const cls = testClassName(test.testName)
  const method = testMethodName(test.testName)
  const barPct = maxDuration > 0 ? (test.meanDuration / maxDuration) * 100 : 0
  const color = testStatusColor(test)
  const colorDim = testStatusColorDim(test)

  return (
    <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--g3)' }} role="row" title={test.testName}>
      <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {method}
        </span>
        {test.isOutlier && <StatusBadge status="outlier" />}
        {test.unstable && <StatusBadge status="unstable" />}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.62rem', color, flexShrink: 0, width: 52, textAlign: 'right' }}>
          {test.meanDuration.toFixed(3)}s
        </span>
      </div>
      {cls && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g5)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 6 }}>
          {cls}
        </div>
      )}
      <div style={{ height: 5, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.5, delay: 0.05 * Math.min(index, 20), ease: 'easeOut' }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: colorDim, borderRight: `2px solid ${color}` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
