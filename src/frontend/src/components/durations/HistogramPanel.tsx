import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { SectionHeader } from '@/components/SectionHeader'
import { Scanlines } from '@/components/Scanlines'
import { ChartTooltip } from '@/components/ChartTooltip'
import type { TestStat } from '@/types/api'

const BUCKETS = [
  { label: '< 0.1s', min: 0, max: 0.1 },
  { label: '0.1–0.5s', min: 0.1, max: 0.5 },
  { label: '0.5–1s', min: 0.5, max: 1 },
  { label: '1–2s', min: 1, max: 2 },
  { label: '2–5s', min: 2, max: 5 },
  { label: '> 5s', min: 5, max: Infinity },
]

export function HistogramPanel({ tests }: { tests: TestStat[] }) {
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
            <XAxis dataKey="label" tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
            <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <RechartsTooltip content={<ChartTooltip precision={3} />} cursor={{ fill: 'oklch(1 0 0 / 0.03)' }} formatter={(v: any) => [v, 'tests']} />
            <Bar dataKey="count" fill="var(--cyan-dim)" stroke="var(--cyan)" strokeWidth={1} radius={0} isAnimationActive animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
