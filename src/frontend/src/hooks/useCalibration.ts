import { useEffect, useState } from 'react'

export function useCalibration(delay = 420): boolean {
  const [calibrated, setCal] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setCal(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return calibrated
}
