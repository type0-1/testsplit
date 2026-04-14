export function Scanlines() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, oklch(0 0 0 / 0.04) 3px, oklch(0 0 0 / 0.04) 4px)',
    }} />
  )
}
