import { useCountUp } from '@/hooks/useCountUp'

export function StatCard({
  label, value, format, sub, accent, active, delay, delta, last,
}: {
  label: string; value: number; format: (v: number) => string; sub: string
  accent: string; active: boolean; delay: number; delta?: number | null; last?: boolean
}) {
  const animated = useCountUp(value, active, delay)
  const sign = delta != null ? (delta > 0 ? '↑' : delta < 0 ? '↓' : '→') : null
  const deltaColor = delta != null ? (delta > 0.02 ? 'var(--orange)' : delta < -0.02 ? 'var(--green)' : 'var(--g6)') : null

  return (
    <div
      className="flex flex-col justify-between p-5"
      style={{ borderRight: last ? 'none' : '1px solid var(--g4)', minWidth: 0, position: 'relative', overflow: 'hidden' }}
      role="group" aria-label={label}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent }} />

      <div className="flex items-start justify-between gap-2 mb-3" style={{ marginTop: 6 }}>
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontWeight: 600, 
          fontSize: '0.52rem', 
          letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--g6)' }}>
          {label}
        </span>
        {sign && delta != null && (
          <span style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.48rem', 
            color: deltaColor!, 
            background: `${deltaColor}22`, 
            border: `1px solid ${deltaColor}`, 
            padding: '1px 5px', 
            flexShrink: 0 
          }}>
            {sign} {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="metric-value" style={{ fontSize: '2.3rem', lineHeight: 1, color: 'var(--g7)' }}>
        {format(animated)}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'var(--g6)', marginTop: '0.55rem' }}>
        {sub}
      </div>
    </div>
  )
}
