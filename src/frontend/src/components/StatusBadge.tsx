type BadgeStatus = 'outlier' | 'unstable' | 'critical'

const BADGE_CONFIG: Record<BadgeStatus, { label: string; color: string; bg: string }> = {
  outlier:  { label: 'OUTLIER',  color: 'var(--orange)', bg: 'var(--orange-dim)' },
  unstable: { label: 'UNSTABLE', color: 'var(--amber)',  bg: 'var(--amber-dim)'  },
  critical: { label: 'CRITICAL', color: 'var(--amber)',  bg: 'var(--amber-dim)'  },
}

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const { label, color, bg } = BADGE_CONFIG[status]
  return (
    <span style={{
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.42rem',
      letterSpacing: '0.1em', color, background: bg,
      border: `1px solid ${color}`, padding: '1px 4px', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}
