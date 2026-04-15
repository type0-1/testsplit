import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { SectionHeader } from '@/components/SectionHeader'
import { Scanlines } from '@/components/Scanlines'
import { ChartTooltip } from '@/components/ChartTooltip'
import type { Job } from '@/types/api'

export function JobChartPanel({ jobs, makespan }: { jobs: Job[]; makespan: number }) {
  const chartData = jobs.map(j => ({
    name: `Job ${j.jobId}`,
    Duration: parseFloat(j.totalTime.toFixed(3)),
    tests: j.tests.length,
  }))
  const maxTime = Math.max(...jobs.map(j => j.totalTime))

  return (
    <div className="flex flex-col h-full">
      <SectionHeader
        accent="var(--cyan)"
        title="Job Duration Comparison"
        right={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 2, background: 'var(--amber)', borderStyle: 'dashed', borderWidth: '0 0 1px 0' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.46rem', color: 'var(--g6)' }}>makespan</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{jobs.length} jobs · {jobs.reduce((a, j) => a + j.tests.length, 0)} tests</span>
          </div>
        }
      />
      <div style={{ flex: 1, padding: '12px 16px 8px 4px', position: 'relative' }}>
        <Scanlines />
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
            <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
            <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.03)' }} />
            <ReferenceLine y={makespan} stroke="var(--amber)" strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: `${makespan.toFixed(2)}s`, position: 'insideTopRight', fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--amber)' }} />
            <Bar dataKey="Duration" radius={0} isAnimationActive animationDuration={800} strokeWidth={1}>
              {chartData.map((entry) => {
                const isCritical = entry.Duration === maxTime
                return (
                  <Cell
                    key={entry.name}
                    fill={isCritical ? 'var(--amber-dim)' : 'var(--cyan-dim)'}
                    stroke={isCritical ? 'var(--amber)' : 'var(--cyan)'}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
