export interface HistoricalDelta {
  runAt: string;
  commit: string | null;
  testCount: number;
  totalDuration: number;
  averageDuration: number;
  criticalPath: number;
  balanceRatio: number;
}
