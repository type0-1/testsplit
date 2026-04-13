import { motion } from 'motion/react'
import type { TestStat } from '@/types/api'

function cvColor(t: TestStat): string {
  if (t.isOutlier) return 'var(--orange)'
  if (t.unstable) return 'var(--amber)'
  return 'var(--cyan)'
}

function cvColorDim(t: TestStat): string {
  if (t.isOutlier) return 'var(--orange-dim)'
  if (t.unstable) return 'var(--amber-dim)'
  return 'var(--cyan-dim)'
}

export function InstabilityRow({ test, index, maxCv }: { test: TestStat; index: number; maxCv: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const cvPct = maxCv > 0 ? (test.coefficientOfVariation / maxCv) * 100 : 0
  const color = cvColor(test)
  const colorDim = cvColorDim(test)
  const cvDisplay = (test.coefficientOfVariation * 100).toFixed(0)

  return (
    <div className="px-5 py-2.5" style={{ borderBottom: '1px solid var(--g3)' }} role="row" title={test.testName}>
      <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {method}
        </span>
        {test.isOutlier && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '1px 4px', flexShrink: 0 }}>
            OUTLIER
          </span>
        )}
        {test.unstable && !test.isOutlier && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 4px', flexShrink: 0 }}>
            UNSTABLE
          </span>
        )}
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
