export interface TestStat {
  testName: string
  runCount: number
  meanDuration: number
  stdDev: number
  min: number
  max: number
  coefficientOfVariation: number
  unstable: boolean
  isOutlier: boolean
  zeroDuration: boolean
}

export interface SummaryResponse {
  totalTests: number
  runCount: number
  avgDuration: number
  unstableCount: number
  outlierCount: number
  makespan: number
  speedupFactor: number
  balanceRatio: number
  sequentialDuration: number
}

export interface TestsResponse {
  total: number
  limit: number
  offset: number
  tests: TestStat[]
}

export interface Job {
  jobId: number
  totalTime: number
  tests: string[]
}

export interface JobsResponse {
  jobs: Job[]
  metrics: Record<string, number>
}

export interface TrendPoint {
  runAt: string
  totalDuration: number
  averageDuration: number
  testCount: number
  criticalPath: number
  balanceRatio: number
}

export interface TrendsResponse {
  trends: TrendPoint[]
}
