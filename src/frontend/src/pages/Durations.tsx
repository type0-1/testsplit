import { useState } from 'react'
import { motion } from 'motion/react'
import { MOCK_TEST_STATS, MOCK_SUMMARY } from '@/data/mockData'
import type { TestStat } from '@/data/mockData'

const ALL_TESTS = Object.values(MOCK_TEST_STATS)
const MAX_DURATION = Math.max(...ALL_TESTS.map(t => t.meanDuration))

const BUCKETS = [
  { label: '< 0.1s', min: 0, max: 0.1 },
  { label: '0.1 - 0.5s', min: 0.1, max: 0.5 },
  { label: '0.5 - 1s', min: 0.5, max: 1 },
  { label: '1 - 2s', min: 1, max: 2 },
  { label: '2 - 5s', min: 2, max: 5 },
  { label: '> 5s', min: 5, max: Infinity },
]

function testColor(t: TestStat): string {
  if (t.isOutlier) return 'var(--orange)'
  if (t.unstable) return 'var(--amber)'
  return 'var(--cyan)'
}

function testColorDim(t: TestStat): string {
  if (t.isOutlier) return 'var(--orange-dim)'
  if (t.unstable) return 'var(--amber-dim)'
  return 'var(--cyan-dim)'
}

type SortKey = 'duration' | 'name' | 'cv'

function sortTests(tests: TestStat[], key: SortKey, asc: boolean): TestStat[] {
  return [...tests].sort((a, b) => {
    let delta = 0
    if (key === 'duration') delta = a.meanDuration - b.meanDuration
    if (key === 'name') delta = a.testName.localeCompare(b.testName)
    if (key === 'cv') delta = a.coefficientOfVariation - b.coefficientOfVariation
    return asc ? delta : -delta
  })
}

function TestRow({ test, index }: { test: TestStat; index: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const barPct = (test.meanDuration / MAX_DURATION) * 100
  const color = testColor(test)
  const colorDim = testColorDim(test)

  return (
    <div
      className="flex items-center gap-4 px-5 py-2.5"
      style={{ borderBottom: '1px solid var(--g3)' }}
      role="row"
    >
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', lineHeight: 1.3 }}>{method}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g5)', lineHeight: 1.3 }}>{cls}</div>
      </div>

      <div style={{ flex: 1, height: 16, background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
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
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.62rem', color, width: 48, textAlign: 'right' }}>
          {test.meanDuration.toFixed(2)}s
        </span>
      </div>
    </div>
  )
}

function HistogramPanel() {
  const counts = BUCKETS.map(b => ({
    ...b,
    count: ALL_TESTS.filter(t => t.meanDuration >= b.min && t.meanDuration < b.max).length,
  }))
  const maxCount = Math.max(...counts.map(b => b.count))

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--g4)' }}>
      <div className="flex items-center gap-2 px-5 py-2" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div style={{ width: 2, height: 10, background: 'var(--cyan)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          Distribution
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g5)', marginLeft: 'auto' }}>
          {ALL_TESTS.length} tests
        </span>
      </div>

      <div className="flex items-end gap-3 px-5 py-3" style={{ height: 100 }}>
        {counts.map((b, i) => (
          <div key={b.label} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.55rem', color: b.count > 0 ? 'var(--cyan)' : 'var(--g4)' }}>
              {b.count}
            </span>
            <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', background: 'var(--g3)', position: 'relative', overflow: 'hidden' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: maxCount === 0 ? 0 : (b.count / maxCount) * 60 }}
                  transition={{ duration: 0.5, delay: 0.06 * i, ease: 'easeOut' }}
                  style={{ width: '100%', background: 'var(--cyan-dim)', borderTop: '2px solid var(--cyan)' }}
                  aria-hidden="true"
                />
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g5)', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Durations() {
  const fastest = ALL_TESTS.reduce((a, b) => a.meanDuration < b.meanDuration ? a : b)
  const slowest = ALL_TESTS.reduce((a, b) => a.meanDuration > b.meanDuration ? a : b)
  const [sortKey, setSortKey] = useState<SortKey>('duration')
  const [asc, setAsc] = useState(false)

  const sorted = sortTests(ALL_TESTS, sortKey, asc)

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(false) }
  }

  const SORT_BUTTONS: { key: SortKey; label: string }[] = [
    { key: 'duration', label: 'Duration' },
    { key: 'name', label: 'Name' },
    { key: 'cv', label: 'CV' },
  ]

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

      <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g5)', marginRight: 4 }}>sort</span>
        {SORT_BUTTONS.map(btn => {
          const active = sortKey === btn.key
          return (
            <button
              key={btn.key}
              onClick={() => handleSort(btn.key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.5rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '2px 8px',
                border: `1px solid ${active ? 'var(--orange)' : 'var(--g4)'}`,
                color: active ? 'var(--orange)' : 'var(--g5)',
                background: active ? 'var(--orange-dim)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {btn.label} {active ? (asc ? '↑' : '↓') : ''}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-auto" role="table" aria-label="Test durations">
          {sorted.map((test, i) => (
            <TestRow key={test.testName} test={test} index={i} />
          ))}
        </div>
        <HistogramPanel />
      </div>
    </div>
  )
}
