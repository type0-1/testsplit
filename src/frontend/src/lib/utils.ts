import type { TrendPoint } from '@/types/api'

export function detectRegression(trends: TrendPoint[]): { field: string; pct: number } | null {
  if (trends.length < 2) return null
  const prev = trends[trends.length - 2]
  const curr = trends[trends.length - 1]
  for (const c of [
    { field: 'makespan', prev: prev.criticalPath, curr: curr.criticalPath },
    { field: 'total duration', prev: prev.totalDuration, curr: curr.totalDuration },
  ]) {
    if (c.prev > 0 && (c.curr - c.prev) / c.prev > 0.10) return { field: c.field, pct: (c.curr - c.prev) / c.prev }
  }
  return null
}

export function pctDelta(curr: number, prev: number | undefined): number | null {
  return (!prev || prev === 0) ? null : (curr - prev) / prev
}

export function formatRunLabel(runAt: string, index: number): string {
  try {
    const d = new Date(runAt)
    if (isNaN(d.getTime())) return `Run ${index + 1}`
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
  } catch { return `Run ${index + 1}` }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
