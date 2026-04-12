import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import type { SummaryResponse, TestsResponse, TestStat } from '@/types/api'

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

//  Color helpers 
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

function toPoint(t: TestStat) {
  return { x: parseFloat(t.meanDuration.toFixed(3)), y: parseFloat((t.coefficientOfVariation * 100).toFixed(1)), name: t.testName.split('.').pop() }
}

//  Scatter chart 
function ScatterPanel({ tests }: { tests: TestStat[] }) {
  const outliers = tests.filter(t => t.isOutlier).map(toPoint)
  const unstable = tests.filter(t => !t.isOutlier && t.unstable).map(toPoint)
  const stable = tests.filter(t => !t.isOutlier && !t.unstable).map(toPoint)

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--g4)' }}>
      <SectionHeader
        accent="var(--amber)"
        title="Duration vs Variance"
        right={
          <div className="flex items-center gap-4">
            {[
              { label: 'Stable', color: 'var(--cyan)' },
              { label: 'Unstable', color: 'var(--amber)' },
              { label: 'Outlier', color: 'var(--orange)' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)' }}>{l.label}</span>
              </div>
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)' }}>CV threshold 50%</span>
          </div>
        }
      />
      <div style={{ height: 180, padding: '8px 16px 8px 4px', position: 'relative' }}>
        <Scanlines />
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" />
            <XAxis
              dataKey="x"
              type="number"
              name="Mean Duration"
              unit="s"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--g4)' }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name="CV"
              unit="%"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--g4)' }}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: 'var(--g4)' }}
              contentStyle={{ background: 'var(--g2)', border: '1px solid var(--g4)', borderRadius: 0, fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}
              formatter={(value: number | string | undefined, name: string | undefined) => [name === 'CV' ? `${value}%` : `${value}s`, name ?? '']}
            />
            <ReferenceLine y={50} stroke="var(--amber)" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Scatter name="Stable" data={stable} fill="var(--cyan)" opacity={0.7} r={3} />
            <Scatter name="Unstable" data={unstable} fill="var(--amber)" opacity={0.85} r={4} />
            <Scatter name="Outlier" data={outliers} fill="var(--orange)" opacity={0.95} r={5} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

//  Instability row 
function InstabilityRow({ test, index, maxCv }: { test: TestStat; index: number; maxCv: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const cvPct = maxCv > 0 ? (test.coefficientOfVariation / maxCv) * 100 : 0
  const color = cvColor(test)
  const colorDim = cvColorDim(test)
  const cvDisplay = (test.coefficientOfVariation * 100).toFixed(0)

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

//  Main component 
export function Instability() {
  const [calibrated, setCalibrated] = useState(false)
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading, error: testsError } = useApi<TestsResponse>('/api/tests?sort=cv&limit=500')

  useEffect(() => {
    const t = setTimeout(() => setCalibrated(true), 420)
    return () => clearTimeout(t)
  }, [])

  const isLoading = summaryLoading || testsLoading
  const errorMessage = summaryError ?? testsError

  if (isLoading) return <PageLoadingSkeleton title="Instability" accentColor="var(--amber)" />
  if (errorMessage) return <PageErrorState title="Instability" error={errorMessage} />
  if (!summary) return <PageErrorState title="Instability" error={summaryError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />
  if (!testsData) return <PageErrorState title="Instability" error={testsError ?? 'No profiling data found. Run: testsplit profile --junit <path>'} />

  const s = summary
  const allTests = testsData.tests
  const maxCv = allTests.length > 0 ? Math.max(...allTests.map(t => t.coefficientOfVariation)) : 1
  const avgCv = allTests.length > 0 ? allTests.reduce((sum, t) => sum + t.coefficientOfVariation, 0) / allTests.length : 0
  const highestCvTest = allTests.length > 0 ? allTests[0] : null

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Instability">

      {/*  Header  */}
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Instability</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--amber)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> Variance Analysis</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>
            {allTests.length} tests loaded
          </span>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ tests: allTests, summary: { totalTests: s.totalTests, unstableCount: s.unstableCount, outlierCount: s.outlierCount }, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `testsplit-instability-${new Date().toISOString().slice(0, 10)}.json`; a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--g6)', background: 'transparent', border: '1px solid var(--g4)', padding: '2px 8px', cursor: 'pointer' }}
          >
            EXPORT
          </button>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '2px 8px' }}>
            {s.unstableCount} UNSTABLE
          </span>
        </div>
      </header>

      {/*  Stat cards  */}
      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Instability metrics">
        <StatCard label="Unstable Tests" value={s.unstableCount} format={v => String(Math.round(v))} sub={`of ${s.totalTests} total tests`} accent="var(--amber)" active={calibrated} delay={0} />
        <StatCard label="Outliers" value={s.outlierCount} format={v => String(Math.round(v))} sub="exceed mean + 2σ threshold" accent="var(--orange)" active={calibrated} delay={100} />
        <StatCard label="Highest CV" value={maxCv * 100} format={v => `${v.toFixed(0)}%`} sub={highestCvTest?.testName.split('.').pop() ?? '-'} accent="var(--chart-5)" active={calibrated} delay={200} />
        <StatCard label="Avg CV" value={avgCv * 100} format={v => `${v.toFixed(0)}%`} sub="coefficient of variation" accent="var(--g5)" active={calibrated} delay={300} last />
      </section>

      {/*  Test list + scatter  */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-auto" role="table" aria-label="Test instability">
          {allTests.map((test, i) => (
            <InstabilityRow key={test.testName} test={test} index={i} maxCv={maxCv} />
          ))}
        </div>
        <ScatterPanel tests={allTests} />
      </div>
    </div>
  )
}
