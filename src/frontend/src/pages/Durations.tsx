import { MOCK_TEST_STATS, MOCK_SUMMARY } from '@/data/mockData'

const ALL_TESTS = Object.values(MOCK_TEST_STATS)

export function Durations() {
  const fastest = ALL_TESTS.reduce((a, b) => a.meanDuration < b.meanDuration ? a : b)
  const slowest = ALL_TESTS.reduce((a, b) => a.meanDuration > b.meanDuration ? a : b)

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Durations">
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Durations</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g5)', letterSpacing: '0.05em' }}>/ Per-Test Breakdown</span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>Last run: 2026-01-19</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '2px 7px' }}>
            {ALL_TESTS.length} TESTS
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        {[
          { label: 'Total Tests', value: `${MOCK_SUMMARY.totalTests}`, sub: `across ${MOCK_SUMMARY.runCount} runs`, rail: 'var(--orange)' },
          { label: 'Avg Duration', value: `${MOCK_SUMMARY.avgDuration.toFixed(2)}s`, sub: 'mean across all tests', rail: 'var(--g5)' },
          { label: 'Slowest', value: `${slowest.meanDuration.toFixed(2)}s`, sub: slowest.testName.split('.').pop() ?? '', rail: 'var(--amber)' },
          { label: 'Fastest', value: `${fastest.meanDuration.toFixed(2)}s`, sub: fastest.testName.split('.').pop() ?? '', rail: 'var(--green)' },
        ].map((p, i, arr) => (
          <div key={p.label} className="flex flex-col justify-between p-4" style={{ borderRight: i === arr.length - 1 ? 'none' : '1px solid var(--g4)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 2, height: 11, background: p.rail, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--g6)' }}>{p.label}</span>
            </div>
            <div className="metric-value" style={{ fontSize: '2.1rem', lineHeight: 1, color: 'var(--g7)' }}>{p.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: 'var(--g5)', marginTop: '0.55rem', letterSpacing: '0.05em' }}>{p.sub}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }} />
    </div>
  )
}
