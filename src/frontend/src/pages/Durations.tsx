import { useState } from 'react'
import { useApi } from '@/hooks/useApi'
import { useCalibration } from '@/hooks/useCalibration'
import { testMethodName } from '@/lib/testName'
import { PageHeader } from '@/components/PageHeader'
import { ExportButton } from '@/components/ExportButton'

import { PageLoadingSkeleton } from '@/components/PageLoadingSkeleton'
import { PageErrorState } from '@/components/PageErrorState'
import { StatCard } from '@/components/StatCard'
import { TestRow } from '@/components/durations/TestRow'
import { HistogramPanel } from '@/components/durations/HistogramPanel'
import { downloadJson } from '@/lib/utils'
import type { SummaryResponse, TestsResponse, TestStat } from '@/types/api'

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

const SORT_BUTTONS: { key: SortKey; label: string }[] = [
  { key: 'duration', label: 'Duration' },
  { key: 'name', label: 'Name' },
  { key: 'cv', label: 'CV' },
]

export function Durations() {
  const calibrated = useCalibration()
  const { data: summary, loading: summaryLoading, error: summaryError } = useApi<SummaryResponse>('/api/summary')
  const { data: testsData, loading: testsLoading, error: testsError } = useApi<TestsResponse>('/api/tests?sort=duration&limit=500')
  const [sortKey, setSortKey] = useState<SortKey>('duration')
  const [asc, setAsc] = useState(false)

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

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label="Durations">

      <PageHeader
        title="Durations"
        accent="var(--orange)"
        subtitle="Per-Test Breakdown"
        right={<>
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.5rem', 
            color: 'var(--g6)' 
            }}>{allTests.length} tests loaded
          </span>
          <ExportButton onClick={() => downloadJson(`testsplit-durations-${new Date().toISOString().slice(0, 10)}.json`, { 
            tests: sorted, 
            summary: { 
              totalTests: s.totalTests, 
              avgDuration: s.avgDuration, 
              runCount: s.runCount 
              }, 
            exportedAt: new Date().toISOString() })} 
          />
          <span style={{ 
            fontFamily: 'var(--font-display)', 
            fontWeight: 600, 
            fontSize: '0.5rem', 
            letterSpacing: '0.1em', 
            color: 'var(--orange)', 
            background: 'var(--orange-dim)', 
            border: '1px solid var(--orange)', 
            padding: '2px 8px' 
            }}>{allTests.length} TESTS
          </span>
        </>}
      />

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }} aria-label="Duration metrics">
        <StatCard 
          label="Total Tests" 
          value={s.totalTests} 
          format={v => String(Math.round(v))} 
          sub={`across ${s.runCount} profiling runs`} 
          accent="var(--orange)" 
          active={calibrated} 
          delay={0} 
        />
        <StatCard 
          label="Avg Duration" 
          value={s.avgDuration} 
          format={v => `${v.toFixed(2)}s`} 
          sub="mean across all tests" 
          accent="var(--g5)" 
          active={calibrated} 
          delay={100} 
        />
        <StatCard 
          label="Slowest" 
          value={slowest?.meanDuration ?? 0} 
          format={v => `${v.toFixed(2)}s`} 
          sub={slowest ? testMethodName(slowest.testName) : '-'} 
          accent="var(--amber)" 
          active={calibrated} 
          delay={200} 
        />
        <StatCard 
          label="Fastest" 
          value={fastest?.meanDuration ?? 0} 
          format={v => `${v.toFixed(3)}s`} 
          sub={fastest ? testMethodName(fastest.testName) : '-'} 
          accent="var(--green)" 
          active={calibrated} 
          delay={300} 
          last 
        />
      </section>

      <div className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.52rem', 
          color: 'var(--g6)', 
          marginRight: 4 
          }}>sort
        </span>

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
                border: `1px solid 
                  ${ active ? 'var(--orange)' : 'var(--g4)'}`, 
                  color: active ? 'var(--orange)' : 'var(--g5)', 
                  background: active ? 'var(--orange-dim)' : 'transparent', 
                  cursor: 'pointer' 
                }}
            >
              {btn.label} {active ? (asc ? '↑' : '↓') : ''}
            </button>
          )
        })}
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.48rem', 
          color: 'var(--g5)', 
          marginLeft: 'auto' 
          }}>
          {allTests.filter(t => t.isOutlier).length} outliers · {allTests.filter(t => t.unstable).length} unstable
        </span>
      </div>

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
