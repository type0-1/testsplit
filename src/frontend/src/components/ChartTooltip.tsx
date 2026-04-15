type TooltipEntry = { name: string; value: number; color?: string }

export function ChartTooltip({ active, payload, label, precision = 2 }: { active?: boolean; payload?: TooltipEntry[]; label?: string; precision?: number }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--g2)', border: '1px solid var(--g4)', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.56rem' }}>
      <p style={{ color: 'var(--g6)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: TooltipEntry) => (
        <div key={p.name} className="flex justify-between gap-6" style={{ marginBottom: 2 }}>
          <span style={{ color: 'var(--g6)' }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: p.color }}>{Number(p.value).toFixed(precision)}s</span>
        </div>
      ))}
    </div>
  )
}
