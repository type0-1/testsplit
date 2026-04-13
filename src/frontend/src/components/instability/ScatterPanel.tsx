import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts'
import { SectionHeader } from '@/components/SectionHeader'
import { Scanlines } from '@/components/Scanlines'
import type { TestStat } from '@/types/api'

const LEGEND = [
  { label: 'Stable', color: 'var(--cyan)' },
  { label: 'Unstable', color: 'var(--amber)' },
  { label: 'Outlier', color: 'var(--orange)' },
]

function toPoint(t: TestStat) {
  return { x: parseFloat(t.meanDuration.toFixed(3)), y: parseFloat((t.coefficientOfVariation * 100).toFixed(1)), name: t.testName.split('.').pop() }
}

export function ScatterPanel({ tests }: { tests: TestStat[] }) {
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
            {LEGEND.map(l => (
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
            <XAxis dataKey="x" type="number" name="Mean Duration" unit="s" tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }} tickLine={false} axisLine={{ stroke: 'var(--g4)' }} />
            <YAxis dataKey="y" type="number" name="CV" unit="%" tick={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--g6)' }} tickLine={false} axisLine={{ stroke: 'var(--g4)' }} width={36} />
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
