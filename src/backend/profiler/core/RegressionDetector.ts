import { StoredHistoricalDelta } from '../../models/StoredHistoricalDelta';
import { RegressionFlag } from '../../models/RegressionFlag';

export function detectRegressions(deltas: StoredHistoricalDelta[], threshold = 0.10): RegressionFlag[] {
  if (deltas.length < 2) return [];

  const sorted = [...deltas].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const latest = sorted[sorted.length - 1].deltas;
  const previous = sorted.slice(0, -1);
  const rollingCriticalPath = previous.reduce((sum, d) => sum + d.deltas.criticalPath, 0) / previous.length;
  const rollingBalanceRatio = previous.reduce((sum, d) => sum + d.deltas.balanceRatio, 0) / previous.length;
  const flags: RegressionFlag[] = [];

  if (rollingCriticalPath > 0) {
    const changePercent = (latest.criticalPath - rollingCriticalPath) / rollingCriticalPath;
    if (changePercent > threshold) {
      flags.push({ metric: 'criticalPath', rollingAverage: rollingCriticalPath, current: latest.criticalPath, changePercent });
    }
  }

  if (rollingBalanceRatio > 0) {
    const changePercent = (latest.balanceRatio - rollingBalanceRatio) / rollingBalanceRatio;
    if (changePercent > threshold) {
      flags.push({ metric: 'balanceRatio', rollingAverage: rollingBalanceRatio, current: latest.balanceRatio, changePercent });
    }
  }

  return flags;
}
