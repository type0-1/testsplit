import { useState, useEffect } from 'react'

export function useApi<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(url).then(res => {
        if (!res.ok) return res.json().then((e: { error?: string }) => Promise.reject(e.error ?? `HTTP ${res.status}`))
        return res.json()
    })
    .then(
      (d: T) => { if (!cancelled) { setData(d); setLoading(false) } })
    .catch(
      (e: unknown) => { if (!cancelled) { setError(String(e)); setLoading(false) } }
    )
    return () => { cancelled = true }
  }, [url])

  return { data, loading, error }
}
