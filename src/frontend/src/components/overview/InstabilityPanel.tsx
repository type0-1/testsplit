import { motion } from 'motion/react'
import { SectionHeader } from '@/components/SectionHeader'
import type { TestStat } from '@/types/api'

export function InstabilityPanel({ tests, totalTests }: { tests: TestStat[]; totalTests: number }) {
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
