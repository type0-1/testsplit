interface PageErrorStateProps {
  title: string
  error: string
}

export function PageErrorState({ title, error }: PageErrorStateProps) {
  const hintMessage = 'No profiling data found. Run testsplit profile --junit <path>'
  const normalizedError = error.toLowerCase().replace(/\s+/g, ' ').trim()
  const repeatsHint =
    normalizedError.includes('no profiling data found') &&
    normalizedError.includes('testsplit profile --junit <path>')
  const detailMessage = repeatsHint ? 'API returned no profiling data.' : `API error: ${error}`

  return (
    <div className="flex flex-col h-full overflow-hidden" aria-label={`${title} error`}>
      <header className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--g4)' }}>
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
      </header>

      <div className="flex-1 flex items-center justify-center px-6">
        <div
          className="w-full max-w-2xl p-5"
          style={{
            border: '1px solid var(--orange)',
            background: 'var(--orange-dim)',
          }}
          role="alert"
          aria-live="assertive"
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '0.62rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--orange-bright)',
              marginBottom: '0.6rem',
            }}
          >
            Unable to load data
          </div>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.66rem',
              lineHeight: 1.7,
              color: 'var(--g7)',
              marginBottom: '0.5rem',
            }}
          >
            {hintMessage}
          </p>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              lineHeight: 1.6,
              color: 'var(--g6)',
              wordBreak: 'break-word',
            }}
          >
            {detailMessage}
          </p>
        </div>
      </div>
    </div>
  )
}
