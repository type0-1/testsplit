import { useEffect, useState } from 'react'

export function useCountUp(target: number, active: boolean, delay = 0): number {
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!active) return

    let startTs: number | null = null
    const DURATION = 700
    let raf: number

    const step = (ts: number) => {
      if (startTs === null) startTs = ts + delay

      const elapsed = ts - startTs

      if (elapsed < 0) { raf = requestAnimationFrame(step); return }

      const p = Math.min(elapsed / DURATION, 1)
      setVal(target * (1 - (1 - p) ** 3))
      if (p < 1) raf = requestAnimationFrame(step)
        
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, target, delay])
  return active ? val : 0
}
