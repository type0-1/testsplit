import { motion } from 'motion/react'
import { testStatusColor, testStatusColorDim } from '@/lib/testStatus'
import { testMethodName, testClassName } from '@/lib/testName'
import { StatusBadge } from '@/components/StatusBadge'
import type { TestStat } from '@/types/api'

export function InstabilityRow({ test, index, maxCv }: { test: TestStat; index: number; maxCv: number }) {
  const cls = testClassName(test.testName)
  const method = testMethodName(test.testName)
  const cvPct = maxCv > 0 ? (test.coefficientOfVariation / maxCv) * 100 : 0
  const color = testStatusColor(test)
  const colorDim = testStatusColorDim(test)
  const cvDisplay = (test.coefficientOfVariation * 100).toFixed(0)

  return (
    <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--g3)' }} role="row" title={test.testName}>
      <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {method}
        </span>
        {test.isOutlier && <StatusBadge status="outlier" />}
        {test.unstable && !test.isOutlier && <StatusBadge status="unstable" />}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.62rem', color, flexShrink: 0, width: 44, textAlign: 'right' }}>
          {cvDisplay}%
        </span>
      </div>
      {cls && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g5)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 4 }}>
          {cls}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)', flexShrink: 0 }}>σ {test.stdDev.toFixed(2)}s</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)', flexShrink: 0 }}>μ {test.meanDuration.toFixed(2)}s</span>
        <div style={{ flex: 1, height: 4, background: 'var(--g3)', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${cvPct}%` }}
            transition={{ duration: 0.5, delay: 0.05 * Math.min(index, 20), ease: 'easeOut' }}
            style={{ height: '100%', background: colorDim, borderRight: `2px solid ${color}` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  )
}
