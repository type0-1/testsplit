/**
 * Outlier Detection inspired by Z-Score method (https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.html)
 * - Computes the upper outlier threshold as mean + 2 std's.
 * - Returns Infinity if std dev is 0 (all values identical, no outliers possible).
 */
export function computeOutlierThreshold(values: number[]): number {
  if (values.length < 2) return Infinity;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return Infinity;

  return mean + 2 * stdDev;
}
