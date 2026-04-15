import type { TestStat } from '@/types/api'

export function testStatusColor(t: TestStat, stable = 'var(--cyan)'): string {
  if (t.isOutlier) return 'var(--orange)'
  if (t.unstable) return 'var(--amber)'
  return stable
}

export function testStatusColorDim(t: TestStat, stable = 'var(--cyan-dim)'): string {
  if (t.isOutlier) return 'var(--orange-dim)'
  if (t.unstable) return 'var(--amber-dim)'
  return stable
}
