import { useApi } from '@/hooks/useApi'
import { useCalibration } from '@/hooks/useCalibration'
import { testMethodName } from '@/lib/testName'
import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import { StatCard } from '@/components/StatCard'
import { InstabilityRow } from '@/components/instability/InstabilityRow'
import { ScatterPanel } from '@/components/instability/ScatterPanel'
import { ExportButton } from '@/components/ExportButton'
import { downloadJson } from '@/lib/utils'
import type { SummaryResponse, TestsResponse } from '@/types/api'

export function Instability() {
  const calibrated = useCalibration()
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading, error: testsError } = useApi<TestsResponse>('/api/tests?sort=cv&limit=500')

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

      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--g7)' }}>Instability</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
            <span style={{ color: 'var(--amber)' }}>/</span>
            <span style={{ color: 'var(--g6)' }}> Variance Analysis</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', color: 'var(--g6)' }}>{allTests.length} tests loaded</span>
          <ExportButton onClick={() => downloadJson(`testsplit-instability-${new Date().toISOString().slice(0, 10)}.json`, { tests: allTests, summary: { totalTests: s.totalTests, unstableCount: s.unstableCount, outlierCount: s.outlierCount }, exportedAt: new Date().toISOString() })} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.5rem', letterSpacing: '0.1em', color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: '2px 8px' }}>
            {s.unstableCount} UNSTABLE
          </span>
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Instability metrics">
        <StatCard label="Unstable Tests" value={s.unstableCount} format={v => String(Math.round(v))} sub={`of ${s.totalTests} total tests`} accent="var(--amber)" active={calibrated} delay={0} />
        <StatCard label="Outliers" value={s.outlierCount} format={v => String(Math.round(v))} sub="exceed mean + 2σ threshold" accent="var(--orange)" active={calibrated} delay={100} />
        <StatCard label="Highest CV" value={maxCv * 100} format={v => `${v.toFixed(0)}%`} sub={highestCvTest ? testMethodName(highestCvTest.testName) : '-'} accent="var(--chart-5)" active={calibrated} delay={200} />
        <StatCard label="Avg CV" value={avgCv * 100} format={v => `${v.toFixed(0)}%`} sub="coefficient of variation" accent="var(--g5)" active={calibrated} delay={300} last />
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
