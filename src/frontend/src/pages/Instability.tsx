import { motion } from 'motion/react'
import { MOCK_TEST_STATS, MOCK_SUMMARY } from '@/data/mockData'
import type { TestStat } from '@/data/mockData'

const ALL_TESTS = Object.values(MOCK_TEST_STATS)
const MAX_CV = Math.max(...ALL_TESTS.map(t => t.coefficientOfVariation))
const AVG_CV = ALL_TESTS.reduce((sum, t) => sum + t.coefficientOfVariation, 0) / ALL_TESTS.length
const SORTED_BY_CV = [...ALL_TESTS].sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation)

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

function InstabilityRow({ test, index }: { test: TestStat; index: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const cvPct = (test.coefficientOfVariation / MAX_CV) * 100
  const color = cvColor(test)
  const colorDim = cvColorDim(test)

  return (
    <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderBottom: '1px solid var(--g3)' }} role="row">
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', lineHeight: 1.3 }}>{method}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', lineHeight: 1.3 }}>{cls}</div>
      </div>

      <div style={{ flex: 1, height: 16, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${cvPct}%` }}
          transition={{ duration: 0.5, delay: 0.05 * index, ease: 'easeOut' }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: colorDim, borderRight: `2px solid ${color}` }}
          aria-hidden="true"
        />
      </div>

      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
        {test.isOutlier && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.47rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '1px 5px' }}>
            OUTLIER
          </span>
        )}
        {test.unstable && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.47rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 5px' }}>
            UNSTABLE
          </span>
        )}
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.62rem', color, width: 44, textAlign: 'right' }}>
          {(test.coefficientOfVariation * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

export function Instability() {
  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Instability">
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Instability</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--amber)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> Variance Analysis</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>Last run: 2026-01-19</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '2px 7px' }}>
            {MOCK_SUMMARY.unstableCount} UNSTABLE
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        {[
          { label: 'Unstable Tests', value: `${MOCK_SUMMARY.unstableCount}`, sub: `of ${MOCK_SUMMARY.totalTests} total tests`, rail: 'var(--amber)' },
          { label: 'Outliers', value: `${MOCK_SUMMARY.outlierCount}`, sub: 'exceed mean + 2σ threshold', rail: 'var(--orange)' },
          { label: 'Highest CV', value: `${(MAX_CV * 100).toFixed(0)}%`, sub: ALL_TESTS.find(t => t.coefficientOfVariation === MAX_CV)?.testName.split('.').pop() ?? '', rail: 'var(--chart-5)' },
          { label: 'Avg CV', value: `${(AVG_CV * 100).toFixed(0)}%`, sub: 'coefficient of variation', rail: 'var(--g5)' },
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

      <div className="flex-1 overflow-auto" style={{ minHeight: 0 }} role="table" aria-label="Test instability">
        {SORTED_BY_CV.map((test, i) => (
          <InstabilityRow key={test.testName} test={test} index={i} />
        ))}
      </div>
    </div>
  )
}
