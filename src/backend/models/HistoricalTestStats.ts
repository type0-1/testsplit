export interface HistoricalTestStats {
  testName: string;
  runCount: number;
  meanDuration: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
}
