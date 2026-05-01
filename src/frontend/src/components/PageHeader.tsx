export function PageHeader({ title, accent, subtitle, right }: {
  title: string
  accent: string
  subtitle: string
  right?: React.ReactNode
}) {
  return (
    <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
      <div className="flex items-center gap-3">
        <span style={{ 
          fontFamily: 'var(--font-display)', 
          fontWeight: 700, 
          fontSize: '0.7rem', 
          letterSpacing: '0.2em', 
          textTransform: 'uppercase', 
          color: 'var(--g7)' 
        }}>
          {title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem' }}>
          <span style={{ color: accent }}>/</span>
          <span style={{ color: 'var(--g6)' }}> {subtitle}</span>
        </span>
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  )
}
