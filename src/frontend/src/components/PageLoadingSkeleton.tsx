interface PageLoadingSkeletonProps {
  title: string
  accentColor: string
}

function SkeletonMetricCard({ accentColor, last }: { accentColor: string; last?: boolean }) {
  return (
    <div
      className="flex flex-col justify-between p-4 animate-pulse"
      style={{ borderRight: last ? 'none' : '1px solid var(--g4)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div style={{ width: 2, height: 11, background: accentColor, flexShrink: 0 }} />
        <div style={{ width: 88, height: 8, background: 'var(--g4)' }} />
      </div>
      <div style={{ width: '55%', height: 30, background: 'var(--g4)' }} />
      <div style={{ width: '72%', height: 8, background: 'var(--g4)', marginTop: '0.55rem' }} />
    </div>
  )
}

export function PageLoadingSkeleton({ title, accentColor }: PageLoadingSkeletonProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label={`${title} loading`}>
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--g7)',
            }}
          >
            {title}
          </span>
          <span className="animate-pulse" style={{ width: 140, height: 8, background: 'var(--g4)' }} />
        </div>
        <div className="flex items-center gap-4 animate-pulse">
          <div style={{ width: 96, height: 8, background: 'var(--g4)' }} />
          <div style={{ width: 68, height: 18, background: 'var(--g4)' }} />
        </div>
      </header>

      <section className="grid grid-cols-4 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
        <SkeletonMetricCard accentColor={accentColor} />
        <SkeletonMetricCard accentColor={accentColor} />
        <SkeletonMetricCard accentColor={accentColor} />
        <SkeletonMetricCard accentColor={accentColor} last />
      </section>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex flex-col flex-1 overflow-hidden" style={{ minWidth: 0 }}>
          <div className="flex items-center justify-between px-5 py-3 shrink-0 animate-pulse" style={{ borderBottom: '1px solid var(--g4)' }}>
            <div style={{ width: 120, height: 8, background: 'var(--g4)' }} />
            <div style={{ width: 110, height: 8, background: 'var(--g4)' }} />
          </div>

          <div className="flex-1 overflow-auto px-5 py-4">
            <div className="flex flex-col gap-3 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 20, background: 'var(--g3)' }} />
              ))}
            </div>
          </div>
        </div>

        <div className="w-[240px] shrink-0" style={{ borderLeft: '1px solid var(--g4)' }}>
          <div className="px-4 py-3 animate-pulse" style={{ borderBottom: '1px solid var(--g4)' }}>
            <div style={{ width: 92, height: 8, background: 'var(--g4)' }} />
          </div>
          <div className="px-4 py-3 animate-pulse">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 14, background: 'var(--g3)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
