// Type definition mocking backend interfaces 

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

export interface RunMetadata {
  runId: string
  generatedAt: string
  commit: string | null
  platform: string
  nodeVersion: string
  cpuModel: string
  cpuCores: number
}

export interface TrendPoint {
  run: string
  runIndex: number
  [testName: string]: string | number
}

export interface Job {
  jobId: number
  totalTime: number
  tests: string[]
}

export interface SchedulingMetrics {
  balanceRatio: number
  makespan: number
  totalDuration: number
  speedupFactor: number
  jobCount: number
}

export interface SummaryMetrics {
  totalTests: number
  runCount: number
  avgDuration: number
  unstableCount: number
  outlierCount: number
  sequentialDuration: number
  makespan: number
  speedupFactor: number
  balanceRatio: number
}

export const MOCK_TEST_STATS: Record<string, TestStat> = {
  'DatabaseIntegrationTest.testConnection': {
    testName: 'DatabaseIntegrationTest.testConnection',
    runCount: 5, meanDuration: 5.21, stdDev: 2.98,
    min: 2.14, max: 9.87, coefficientOfVariation: 0.57,
    unstable: true, isOutlier: true, zeroDuration: false,
  },
  'PaymentProcessorTest.testCharge': {
    testName: 'PaymentProcessorTest.testCharge',
    runCount: 5, meanDuration: 4.83, stdDev: 2.71,
    min: 1.92, max: 8.34, coefficientOfVariation: 0.56,
    unstable: true, isOutlier: false, zeroDuration: false,
  },
  'DatabaseIntegrationTest.testMigration': {
    testName: 'DatabaseIntegrationTest.testMigration',
    runCount: 5, meanDuration: 3.76, stdDev: 0.31,
    min: 3.41, max: 4.12, coefficientOfVariation: 0.08,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'PaymentProcessorTest.testRefund': {
    testName: 'PaymentProcessorTest.testRefund',
    runCount: 5, meanDuration: 3.24, stdDev: 1.89,
    min: 1.10, max: 5.88, coefficientOfVariation: 0.58,
    unstable: true, isOutlier: false, zeroDuration: false,
  },
  'ApiEndpointTest.testCreateUser': {
    testName: 'ApiEndpointTest.testCreateUser',
    runCount: 5, meanDuration: 1.61, stdDev: 0.12,
    min: 1.47, max: 1.79, coefficientOfVariation: 0.07,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'ApiEndpointTest.testUpdateUser': {
    testName: 'ApiEndpointTest.testUpdateUser',
    runCount: 5, meanDuration: 1.52, stdDev: 0.10,
    min: 1.38, max: 1.66, coefficientOfVariation: 0.07,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'ApiEndpointTest.testGetUser': {
    testName: 'ApiEndpointTest.testGetUser',
    runCount: 5, meanDuration: 1.44, stdDev: 0.09,
    min: 1.31, max: 1.57, coefficientOfVariation: 0.06,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'UserRepositoryTest.testSave': {
    testName: 'UserRepositoryTest.testSave',
    runCount: 5, meanDuration: 1.12, stdDev: 0.08,
    min: 1.01, max: 1.24, coefficientOfVariation: 0.07,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'UserRepositoryTest.testFindById': {
    testName: 'UserRepositoryTest.testFindById',
    runCount: 5, meanDuration: 0.91, stdDev: 0.06,
    min: 0.83, max: 0.99, coefficientOfVariation: 0.07,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'UserRepositoryTest.testDelete': {
    testName: 'UserRepositoryTest.testDelete',
    runCount: 5, meanDuration: 0.83, stdDev: 0.05,
    min: 0.76, max: 0.91, coefficientOfVariation: 0.06,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'EmailServiceTest.testSend': {
    testName: 'EmailServiceTest.testSend',
    runCount: 5, meanDuration: 0.52, stdDev: 0.04,
    min: 0.47, max: 0.58, coefficientOfVariation: 0.08,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'AuthServiceTest.testLogin': {
    testName: 'AuthServiceTest.testLogin',
    runCount: 5, meanDuration: 0.38, stdDev: 0.03,
    min: 0.34, max: 0.43, coefficientOfVariation: 0.08,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'ValidationTest.testEmail': {
    testName: 'ValidationTest.testEmail',
    runCount: 5, meanDuration: 0.29, stdDev: 0.02,
    min: 0.26, max: 0.32, coefficientOfVariation: 0.07,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'AuthServiceTest.testLogout': {
    testName: 'AuthServiceTest.testLogout',
    runCount: 5, meanDuration: 0.22, stdDev: 0.01,
    min: 0.20, max: 0.24, coefficientOfVariation: 0.05,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'ValidationTest.testPassword': {
    testName: 'ValidationTest.testPassword',
    runCount: 5, meanDuration: 0.19, stdDev: 0.01,
    min: 0.17, max: 0.21, coefficientOfVariation: 0.05,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'CacheServiceTest.testSet': {
    testName: 'CacheServiceTest.testSet',
    runCount: 5, meanDuration: 0.09, stdDev: 0.01,
    min: 0.08, max: 0.11, coefficientOfVariation: 0.11,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
  'CacheServiceTest.testGet': {
    testName: 'CacheServiceTest.testGet',
    runCount: 5, meanDuration: 0.08, stdDev: 0.01,
    min: 0.07, max: 0.10, coefficientOfVariation: 0.13,
    unstable: false, isOutlier: false, zeroDuration: false,
  },
}


// Keys used as recharts dataKey 
export const TREND_KEYS = [
  'DB.testConnection',
  'Payment.testCharge',
  'DB.testMigration',
  'Payment.testRefund',
  'Api.testCreateUser',
] as const

export type TrendKey = typeof TREND_KEYS[number]

export const TREND_KEY_LABELS: Record<TrendKey, string> = {
  'DB.testConnection':   'DatabaseIntegrationTest.testConnection',
  'Payment.testCharge':  'PaymentProcessorTest.testCharge',
  'DB.testMigration':    'DatabaseIntegrationTest.testMigration',
  'Payment.testRefund':  'PaymentProcessorTest.testRefund',
  'Api.testCreateUser':  'ApiEndpointTest.testCreateUser',
}

export const MOCK_TRENDS: TrendPoint[] = [
  { run: 'Run 1', runIndex: 1, 'DB.testConnection': 3.10, 'Payment.testCharge': 6.20, 'DB.testMigration': 3.60, 'Payment.testRefund': 4.80, 'Api.testCreateUser': 1.55 },
  { run: 'Run 2', runIndex: 2, 'DB.testConnection': 9.87, 'Payment.testCharge': 2.10, 'DB.testMigration': 3.90, 'Payment.testRefund': 1.10, 'Api.testCreateUser': 1.70 },
  { run: 'Run 3', runIndex: 3, 'DB.testConnection': 4.50, 'Payment.testCharge': 8.34, 'DB.testMigration': 4.12, 'Payment.testRefund': 5.88, 'Api.testCreateUser': 1.47 },
  { run: 'Run 4', runIndex: 4, 'DB.testConnection': 2.14, 'Payment.testCharge': 3.80, 'DB.testMigration': 3.41, 'Payment.testRefund': 2.20, 'Api.testCreateUser': 1.79 },
  { run: 'Run 5', runIndex: 5, 'DB.testConnection': 6.44, 'Payment.testCharge': 3.71, 'DB.testMigration': 3.76, 'Payment.testRefund': 2.24, 'Api.testCreateUser': 1.56 },
]

// LPT job distribution 

export const MOCK_JOBS: Job[] = [
  {
    jobId: 0,
    totalTime: 5.58,
    tests: [
      'DatabaseIntegrationTest.testConnection',
      'ValidationTest.testEmail',
      'ValidationTest.testPassword',
      'CacheServiceTest.testGet',
      'CacheServiceTest.testSet',
    ],
  },
  {
    jobId: 1,
    totalTime: 5.74,
    tests: [
      'PaymentProcessorTest.testCharge',
      'UserRepositoryTest.testFindById',
    ],
  },
  {
    jobId: 2,
    totalTime: 5.59,
    tests: [
      'DatabaseIntegrationTest.testMigration',
      'ApiEndpointTest.testCreateUser',
      'AuthServiceTest.testLogin',
      'AuthServiceTest.testLogout',
    ],
  },
  {
    jobId: 3,
    totalTime: 5.81,
    tests: [
      'PaymentProcessorTest.testRefund',
      'ApiEndpointTest.testUpdateUser',
      'ApiEndpointTest.testGetUser',
      'UserRepositoryTest.testDelete',
      'UserRepositoryTest.testSave',
      'EmailServiceTest.testSend',
    ],
  },
]

export const MOCK_SUMMARY: SummaryMetrics = {
  totalTests: 17,
  runCount: 5,
  avgDuration: 1.41,
  unstableCount: 3,
  outlierCount: 1,
  sequentialDuration: 26.04,
  makespan: 5.81,
  speedupFactor: 4.48,
  balanceRatio: 0.96,
}


export const MOCK_RUN_METADATA: RunMetadata[] = [
  { runId: 'run-2026-01-15T09-12-04-000Z', generatedAt: '2026-01-15T09:12:04Z', commit: 'a3f82c1', platform: 'linux', nodeVersion: 'v20.19.0', cpuModel: 'AMD EPYC 7B13', cpuCores: 8 },
  { runId: 'run-2026-01-16T11-34-21-000Z', generatedAt: '2026-01-16T11:34:21Z', commit: 'b91e04d', platform: 'linux', nodeVersion: 'v20.19.0', cpuModel: 'AMD EPYC 7B13', cpuCores: 8 },
  { runId: 'run-2026-01-17T08-55-47-000Z', generatedAt: '2026-01-17T08:55:47Z', commit: 'c7a3190', platform: 'linux', nodeVersion: 'v20.19.0', cpuModel: 'AMD EPYC 7B13', cpuCores: 8 },
  { runId: 'run-2026-01-18T14-02-33-000Z', generatedAt: '2026-01-18T14:02:33Z', commit: 'd2f60b8', platform: 'linux', nodeVersion: 'v20.19.0', cpuModel: 'AMD EPYC 7B13', cpuCores: 8 },
  { runId: 'run-2026-01-19T10-48-09-000Z', generatedAt: '2026-01-19T10:48:09Z', commit: 'e5c91a3', platform: 'linux', nodeVersion: 'v20.19.0', cpuModel: 'AMD EPYC 7B13', cpuCores: 8 },
]

// Colours for trends (CSS vars for theming)
export const TREND_COLORS: Record<TrendKey, string> = {
  'DB.testConnection':  'var(--orange)',
  'Payment.testCharge': 'var(--amber)',
  'DB.testMigration':   'var(--cyan)',
  'Payment.testRefund': 'var(--chart-5)',
  'Api.testCreateUser': 'var(--green)',
}
