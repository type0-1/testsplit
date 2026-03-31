import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import type { SummaryResponse, TestsResponse, TestStat } from '@/types/api'

const BUCKETS = [
  { label: '< 0.1s', min: 0, max: 0.1 },
  { label: '0.1–0.5s', min: 0.1, max: 0.5 },
  { label: '0.5–1s', min: 0.5, max: 1 },
  { label: '1–2s', min: 1, max: 2 },
  { label: '2–5s', min: 2, max: 5 },
  { label: '> 5s', min: 5, max: Infinity },
]

//  Count-up animation 
function useCountUp(target: number, active: boolean, delay = 0): number {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    let startTs: number | null = null
    const DURATION = 700
    let raf: number
    const step = (ts: number) => {
      if (startTs === null) startTs = ts + delay
      const elapsed = ts - startTs
      if (elapsed < 0) { raf = requestAnimationFrame(step); return }
      const p = Math.min(elapsed / DURATION, 1)
      setVal(target * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, delay])
  return val
}

//  Stat card 
function StatCard({
  label, value, format, sub, accent, active, delay, last,
}: {
  label: string; value: number; format: (v: number) => string; sub: string
  accent: string; active: boolean; delay: number; last?: boolean
}) {
  const animated = useCountUp(value, active, delay)
  return (
    <div
      className="flex flex-col justify-between p-5"
      style={{ borderRight: last ? 'none' : '1px solid var(--g4)', minWidth: 0, position: 'relative', overflow: 'hidden' }}
      role="group" aria-label={label}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--g6)', marginTop: 6 }}>
        {label}
      </span>
      <div className="metric-value" style={{ fontSize: '2.3rem', lineHeight: 1, color: 'var(--g7)', marginTop: 12 }}>
        {format(animated)}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', marginTop: '0.55rem' }}>
        {sub}
      </div>
    </div>
  )
}

//  Section header 
function SectionHeader({ accent, title, right }: { accent: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
      <div style={{ width: 2, height: 10, background: accent, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--g6)' }}>
        {title}
      </span>
      {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
    </div>
  )
}

//  Scanlines 
function Scanlines() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.04) 3px, oklch(0 0 0 / 0.04) 4px)',
    }} />
  )
}

//  Chart tooltip 
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--g2)', border: '1px solid var(--g4)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.56rem' }}>
      <p style={{ color: 'var(--g6)', marginBottom: 6, maxWidth: 180, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ marginBottom: 2 }}>
          <span style={{ color: 'var(--g6)' }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: p.color }}>{Number(p.value).toFixed(3)}s</span>
        </div>
      ))}
    </div>
  )
}

//  Test color helpers 
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

// Test row 
function TestRow({ test, index, maxDuration }: { test: TestStat; index: number; maxDuration: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const barPct = maxDuration > 0 ? (test.meanDuration / maxDuration) * 100 : 0
  const color = testColor(test)
  const colorDim = testColorDim(test)

  return (
    <div
      className="px-5 py-2.5"
      style={{ borderBottom: '1px solid var(--g3)' }}
      role="row"
      title={test.testName}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--g7)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {method}
        </span>
        {test.isOutlier && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '1px 4px', flexShrink: 0 }}>
            OUTLIER
          </span>
        )}
        {test.unstable && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '1px 4px', flexShrink: 0 }}>
            UNSTABLE
          </span>
        )}
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

//  Distribution chart 
function HistogramPanel({ tests }: { tests: TestStat[] }) {
  const counts = BUCKETS.map(b => ({
    label: b.label,
    count: tests.filter(t => t.meanDuration >= b.min && t.meanDuration < b.max).length,
  }))

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--g4)' }}>
      <SectionHeader
        accent="var(--cyan)"
        title="Duration Distribution"
        right={<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{tests.length} tests</span>}
      />
      <div style={{ height: 140, padding: '12px 16px 8px 4px', position: 'relative' }}>
        <Scanlines />
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={counts} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }}
              axisLine={{ stroke: 'var(--g4)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <RechartsTooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'oklch(1 0 0 / 0.03)' }}
              formatter={(v: any) => [v, 'tests']}
            />
            <Bar dataKey="count" fill="var(--cyan-dim)" stroke="var(--cyan)" strokeWidth={1} radius={0} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

//  Main component 
export function Durations() {
  const [calibrated, setCalibrated] = useState(false)
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading, error: testsError } = useApi<TestsResponse>('/api/tests?sort=duration&limit=500')
  const [sortKey, setSortKey] = useState<SortKey>('duration')
  const [asc, setAsc] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

  const isLoading = summaryLoading || testsLoading
  const errorMessage = summaryError ?? testsError

  if (isLoading) return <PageLoadingSkeleton title="Durations" accentColor="var(--orange)" />
  if (errorMessage) return <PageErrorState title="Durations" error={errorMessage} />
  if (!summary) return <PageErrorState title="Durations" error={summaryError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />
  if (!testsData) return <PageErrorState title="Durations" error={testsError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />

  const s = summary
  const allTests = testsData.tests
  const maxDuration = allTests.length > 0 ? Math.max(...allTests.map(t => t.meanDuration)) : 1
  const fastest = allTests.length > 0 ? allTests.reduce((a, b) => a.meanDuration < b.meanDuration ? a : b) : null
  const slowest = allTests.length > 0 ? allTests.reduce((a, b) => a.meanDuration > b.meanDuration ? a : b) : null
  const sorted = sortTests(allTests, sortKey, asc)

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

      {/*  Header  */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Durations</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--orange)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> Per-Test Breakdown</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>
            {allTests.length} tests loaded
          </span>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ tests: sorted, summary: { totalTests: s.totalTests, avgDuration: s.avgDuration, runCount: s.runCount }, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `testsplit-durations-${new Date().toISOString().slice(0, 10)}.json`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--g6)', background: 'transparent', border: '1px solid var(--g4)', padding: '2px 8px', cursor: 'pointer' }}
          >
            EXPORT
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--orange)', background: 'var(--orange-dim)', border: '1px solid var(--orange)', padding: '2px 8px' }}>
            {allTests.length} TESTS
          </span>
        </div>
      </header>

      {/*  Stat cards  */}
      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Duration metrics">
        <StatCard label="Total Tests" value={s.totalTests} format={v => String(Math.round(v))} sub={`across ${s.runCount} profiling runs`} accent="var(--orange)" active={calibrated} delay={0} />
        <StatCard label="Avg Duration" value={s.avgDuration} format={v => `${v.toFixed(2)}s`} sub="mean across all tests" accent="var(--g5)" active={calibrated} delay={100} />
        <StatCard label="Slowest" value={slowest?.meanDuration ?? 0} format={v => `${v.toFixed(2)}s`} sub={slowest?.testName.split('.').pop() ?? '—'} accent="var(--amber)" active={calibrated} delay={200} />
        <StatCard label="Fastest" value={fastest?.meanDuration ?? 0} format={v => `${v.toFixed(3)}s`} sub={fastest?.testName.split('.').pop() ?? '—'} accent="var(--green)" active={calibrated} delay={300} last />
      </section>

      {/*  Sort controls  */}
      <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', marginRight: 4 }}>sort</span>
        {SORT_BUTTONS.map(btn => {
          const active = sortKey === btn.key
          return (
            <button
              key={btn.key}
              onClick={() => handleSort(btn.key)}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '0.48rem',
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g5)', marginLeft: 'auto' }}>
          {allTests.filter(t => t.isOutlier).length} outliers · {allTests.filter(t => t.unstable).length} unstable
        </span>
      </div>

      {/*  Test list + histogram  */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-auto" role="table" aria-label="Test durations">
          {sorted.map((test, i) => (
            <TestRow key={test.testName} test={test} index={i} maxDuration={maxDuration} />
          ))}
        </div>
        <HistogramPanel tests={allTests} />
      </div>
    </div>
  )
}
