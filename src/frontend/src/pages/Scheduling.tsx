import { MOCK_SUMMARY, MOCK_JOBS } from '@/data/mockData'

export function Scheduling() {
  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Scheduling">
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Scheduling</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', letterSpacing: '0.05em' }}>
            <span style={{ color: 'var(--cyan)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> LPT Job Distribution</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>Last run: 2026-01-19</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', padding: '2px 7px' }}>
            {MOCK_JOBS.length} JOBS
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        {[
          { label: 'Makespan', value: `${MOCK_SUMMARY.makespan.toFixed(2)}s`, sub: 'critical path duration', rail: 'var(--cyan)' },
          { label: 'Speed-up', value: `${MOCK_SUMMARY.speedupFactor.toFixed(2)}×`, sub: `vs ${MOCK_SUMMARY.sequentialDuration.toFixed(2)}s sequential`, rail: 'var(--green)' },
          { label: 'Balance', value: `${Math.round(MOCK_SUMMARY.balanceRatio * 100)}%`, sub: 'load balance ratio', rail: 'var(--amber)' },
          { label: 'Parallel Jobs', value: `${MOCK_JOBS.length}`, sub: `${MOCK_SUMMARY.totalTests} tests distributed`, rail: 'var(--g5)' },
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
