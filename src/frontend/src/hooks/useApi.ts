import useSWR from 'swr'

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useApi<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const { data, error, isLoading } = useSWR<T>(url, fetcher)
  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message 
         : error ? String(error) : null,
  }
}
