import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { SectionHeader } from '@/components/SectionHeader'
import { Scanlines } from '@/components/Scanlines'
import { ChartTooltip } from '@/components/ChartTooltip'

interface ChartPoint { run: string; Total: number; Makespan: number }

export function TrendChartPanel({ chartData }: { chartData: ChartPoint[] }) {
  const useBarChart = chartData.length < 3

  return (
    <div className="flex flex-col flex-1" style={{ minWidth: 0, borderRight: '1px solid var(--g4)', position: 'relative' }}>
      <SectionHeader
        accent="var(--orange)"
        title="Duration Trend"
        right={
          <div className="flex items-center gap-4">
            {[{ label: 'Total', color: 'var(--orange)' }, { label: 'Makespan', color: 'var(--cyan)' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div style={{ width: 10, height: 2, background: l.color }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.48rem', color: 'var(--g6)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        }
      />
      <div className="flex-1" style={{ position: 'relative', padding: '8px 12px 8px 4px' }}>
        <Scanlines />
        <ResponsiveContainer width="100%" height="100%">
          {useBarChart ? (
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
              <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
              <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
              <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.03)' }} />
              <Bar dataKey="Total" fill="var(--orange-dim)" stroke="var(--orange)" strokeWidth={1} radius={0} />
              <Bar dataKey="Makespan" fill="var(--cyan-dim)" stroke="var(--cyan)" strokeWidth={1} radius={0} />
            </BarChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--orange)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--orange)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gMakespan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--g4)" vertical={false} />
              <XAxis dataKey="run" tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={{ stroke: 'var(--g4)' }} tickLine={false} />
              <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--g6)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}s`} />
              <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--g4)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="Total" stroke="var(--orange)" strokeWidth={1.5} fill="url(#gTotal)" dot={{ r: 3, fill: 'var(--orange)', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
              <Area type="monotone" dataKey="Makespan" stroke="var(--cyan)" strokeWidth={1.5} fill="url(#gMakespan)" dot={{ r: 3, fill: 'var(--cyan)', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={900} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
