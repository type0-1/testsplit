export interface HistoricalTestStats {
  testName: string;
  runCount: number;
  meanDuration: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
  coefficientOfVariation: number;
  unstable: boolean;
  zeroDuration: boolean;
}
