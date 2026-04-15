export function SectionHeader({ accent, title, right }: { accent: string; title: string; right?: React.ReactNode }) {
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
