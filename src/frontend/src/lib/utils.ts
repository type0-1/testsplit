import type { TrendPoint } from '@/types/api'

export function detectRegression(trends: TrendPoint[]): { field: string; pct: number } | null {
  if (trends.length < 2) return null
  const prev = trends[trends.length - 2]
  const curr = trends[trends.length - 1]
  for (const c of [
    { field: 'makespan', prev: prev.criticalPath, curr: curr.criticalPath },
    { field: 'total duration', prev: prev.totalDuration, curr: curr.totalDuration },
  ]) {
    const pct = percentageChange(c.curr, c.prev)
    if (pct !== null && pct > 0.10) return { field: c.field, pct }
  }
  return null
}

/**
 * Used to calc percentage between two values 
 * (trend charts for e.g. which shows what % change there is between two runs)
 * calculation derived from https://www.investopedia.com/terms/p/percentage-change.asp
 */

export function percentageChange(curr: number, prev: number | undefined): number | null {
  return (!prev || prev === 0) ? null : (curr - prev) / prev
}

export const pctDelta = percentageChange

export function formatRunLabel(runAt: string, index: number): string {
  try {
    const d = new Date(runAt)
    if (isNaN(d.getTime())) return `Run ${index + 1}`
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) // e.g. "Jan 01"
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
