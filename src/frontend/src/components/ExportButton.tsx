export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ 
        fontFamily: 'var(--font-display)', 
        fontWeight: 600, 
        fontSize: '0.5rem', 
        letterSpacing: '0.1em', 
        color: 'var(--g6)', 
        background: 'transparent', 
        border: '1px solid var(--g4)', 
        padding: '2px 8px', 
        cursor: 'pointer' 
      }}
    >
      EXPORT
    </button>
  )
}
