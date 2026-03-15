import { motion } from 'motion/react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useApi } from '@/hooks/useApi'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import type { SummaryResponse, TestsResponse, TestStat } from '@/types/api'

function toPoint(t: TestStat) {
  return { x: parseFloat(t.meanDuration.toFixed(3)), y: parseFloat((t.coefficientOfVariation * 100).toFixed(1)), name: t.testName.split('.').pop() }
}

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

function ScatterPanel({ tests }: { tests: TestStat[] }) {
  const outliers = tests.filter(t => t.isOutlier).map(toPoint)
  const unstable = tests.filter(t => !t.isOutlier && t.unstable).map(toPoint)
  const stable = tests.filter(t => !t.isOutlier && !t.unstable).map(toPoint)

  return (
    <div className="shrink-0" style={{ borderTop: '1px solid var(--g4)' }}>
      <div className="flex items-center gap-2 px-5 py-2" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div style={{ width: 2, height: 10, background: 'var(--amber)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.57rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          Duration vs Variance
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)', marginLeft: 'auto' }}>
          CV threshold 50%
        </span>
      </div>

      <div style={{ height: 160, paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="x"
              type="number"
              name="Mean Duration"
              unit="s"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', fill: 'var(--g6)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--g4)' }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name="CV"
              unit="%"
              tick={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', fill: 'var(--g6)' }}
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

function InstabilityRow({ test, index, maxCv }: { test: TestStat; index: number; maxCv: number }) {
  const cls = test.testName.includes('.') ? test.testName.substring(0, test.testName.lastIndexOf('.')) : ''
  const method = test.testName.split('.').pop() ?? test.testName
  const cvPct = maxCv > 0 ? (test.coefficientOfVariation / maxCv) * 100 : 0
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
          transition={{ duration: 0.5, delay: 0.05 * Math.min(index, 20), ease: 'easeOut' }}
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
  const { data: summary, loading: summaryLoading } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading } = useApi<TestsResponse>('/api/tests?sort=cv&limit=500')

  const isLoading = summaryLoading || testsLoading

  if (isLoading) {
    return <PageLoadingSkeleton title="Instability" accentColor="var(--amber)" />
  }

  const s = summary ?? { totalTests: 0, runCount: 0, avgDuration: 0, unstableCount: 0, outlierCount: 0, makespan: 0, speedupFactor: 1, balanceRatio: 1, sequentialDuration: 0 }
  const allTests = testsData?.tests ?? []
  const maxCv = allTests.length > 0 ? Math.max(...allTests.map(t => t.coefficientOfVariation)) : 1
  const avgCv = allTests.length > 0 ? allTests.reduce((sum, t) => sum + t.coefficientOfVariation, 0) / allTests.length : 0
  const highestCvTest = allTests.length > 0 ? allTests[0] : null // sorted by cv desc from API

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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'var(--g6)' }}>
            {allTests.length > 0 ? `${allTests.length} tests loaded` : 'Loading…'}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.52rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '2px 7px' }}>
            {s.unstableCount} UNSTABLE
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        {[
          { label: 'Unstable Tests', value: `${s.unstableCount}`, sub: `of ${s.totalTests} total tests`, rail: 'var(--amber)' },
          { label: 'Outliers', value: `${s.outlierCount}`, sub: 'exceed mean + 2σ threshold', rail: 'var(--orange)' },
          { label: 'Highest CV', value: `${(maxCv * 100).toFixed(0)}%`, sub: highestCvTest?.testName.split('.').pop() ?? '', rail: 'var(--chart-5)' },
          { label: 'Avg CV', value: `${(avgCv * 100).toFixed(0)}%`, sub: 'coefficient of variation', rail: 'var(--g5)' },
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
