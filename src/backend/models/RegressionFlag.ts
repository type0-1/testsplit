export interface RegressionFlag {
  metric: 'criticalPath' | 'balanceRatio';
  rollingAverage: number;
  current: number;
  changePercent: number;
}
