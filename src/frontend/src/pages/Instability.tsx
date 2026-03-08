import { MOCK_TEST_STATS, MOCK_SUMMARY } from '@/data/mockData'

const ALL_TESTS = Object.values(MOCK_TEST_STATS)
const MAX_CV = Math.max(...ALL_TESTS.map(t => t.coefficientOfVariation))
const AVG_CV = ALL_TESTS.reduce((sum, t) => sum + t.coefficientOfVariation, 0) / ALL_TESTS.length

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

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }} />
    </div>
  )
}
