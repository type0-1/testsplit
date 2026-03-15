import { buildApp } from '../../../../src/backend/api/server';
import { FileStore } from '../../../../src/backend/storage/FileStore';

jest.mock('../../../../src/backend/storage/FileStore');

const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;

const makeTestStat = (overrides: Partial<{testName: string; meanDuration: number;
  coefficientOfVariation: number;
  unstable: boolean;
  isOutlier: boolean;
}> = {}) => ({
  testName: 'com.example.TestA',
  runCount: 2,
  meanDuration: 1.0,
  variance: 0.1,
  stdDev: 0.3,
  min: 0.7,
  max: 1.3,
  coefficientOfVariation: 0.3,
  unstable: false,
  zeroDuration: false,
  isOutlier: false,
  ...overrides,
});

const mockHistorical = {
  runCount: 3,
  totalTests: 9,
  averageTestDuration: 1.5,
  testDurationVariance: 0.2,
  profiles: [],
  metadata: [],
  perTestStats: {
    'com.example.TestA': makeTestStat({ testName: 'com.example.TestA', meanDuration: 3.0, coefficientOfVariation: 0.6, unstable: true }),
    'com.example.TestB': makeTestStat({ testName: 'com.example.TestB', meanDuration: 1.0, coefficientOfVariation: 0.1, isOutlier: true }),
    'com.example.TestC': makeTestStat({ testName: 'com.example.TestC', meanDuration: 2.0, coefficientOfVariation: 0.3 }),
  },
};

const mockDistribution = {
  jobs: [
    { totalTime: 3.0, tasks: [{ id: 'com.example.TestA' }] },
    { totalTime: 3.0, tasks: [{ id: 'com.example.TestB' }, { id: 'com.example.TestC' }] },
  ],
  metrics: { criticalPath: 3.0, balanceRatio: 1.0 },
};

const mockDelta = {
  createdAt: '2026-01-01T00:00:00.000Z',
  deltas: { runAt: '2026-01-01T00:00:00.000Z', commit: null, testCount: 3, totalDuration: 6.0, averageDuration: 2.0, criticalPath: 3.0, balanceRatio: 1.0 },
};

describe('API server', () => {
  let mockStore: jest.Mocked<FileStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {
      loadHistoricalProfile: jest.fn().mockReturnValue(mockHistorical),
      loadLatestDistribution: jest.fn().mockReturnValue(mockDistribution),
      loadHistoricalDeltas: jest.fn().mockReturnValue([mockDelta]),
      saveProfile: jest.fn(),
      saveDistribution: jest.fn(),
      saveHistoricalProfile: jest.fn(),
      saveHistoricalDeltas: jest.fn(),
      loadProfiles: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<FileStore>;
    MockFileStore.mockImplementation(() => mockStore);
  });

  describe('GET /api/health', () => {
    it('returns ok status payload', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/health' });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/summary', () => {
    it('returns 404 when no historical profile and no deltas', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      mockStore.loadHistoricalDeltas.mockReturnValue([]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      expect(res.statusCode).toBe(404);
    });

    it('derives totalTests from perTestStats length and counts unstable/outlier correctly', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);
      expect(body.totalTests).toBe(3);
      expect(body.totalTests).not.toBe(mockHistorical.totalTests);
      expect(body.unstableCount).toBe(1);
      expect(body.outlierCount).toBe(1);
    });

    it('falls back to latest delta testCount when no historical profile', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);
      expect(body.totalTests).toBe(mockDelta.deltas.testCount);
    });

    it('sets speedupFactor to 1 when criticalPath is zero', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({ ...mockDistribution, metrics: { criticalPath: 0, balanceRatio: 1.0 } });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);
      expect(body.speedupFactor).toBe(1);
    });
  });

  describe('GET /api/tests', () => {
    it('returns 404 when no historical profile', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests' });
      expect(res.statusCode).toBe(404);
    });

    it('sorts by duration descending by default', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests' });
      const body = JSON.parse(res.body);
      const durations = body.tests.map((t: any) => t.meanDuration);
      expect(durations).toEqual([3.0, 2.0, 1.0]);
    });

    it('sorts by cv descending when sort=cv', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests?sort=cv' });
      const body = JSON.parse(res.body);
      const cvs = body.tests.map((t: any) => t.coefficientOfVariation);
      expect(cvs).toEqual([0.6, 0.3, 0.1]);
    });

    it('sorts by name ascending when sort=name', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests?sort=name' });
      const body = JSON.parse(res.body);
      const names = body.tests.map((t: any) => t.testName);
      expect(names).toEqual(['com.example.TestA', 'com.example.TestB', 'com.example.TestC']);
    });

    it('paginates with limit and offset', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests?limit=2&offset=1' });
      const body = JSON.parse(res.body);
      expect(body.tests).toHaveLength(2);
      expect(body.total).toBe(3);
      expect(body.offset).toBe(1);
    });

    it('clamps limit to 500 at the boundary (limit=501)', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests?limit=501' });
      const body = JSON.parse(res.body);
      expect(body.limit).toBe(500);
    });

    it('defaults limit to 100 when limit=0 is provided', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/tests?limit=0' });
      const body = JSON.parse(res.body);
      expect(body.limit).toBe(100);
    });
  });

  describe('GET /api/jobs', () => {
    it('returns 404 when no distribution', async () => {
      mockStore.loadLatestDistribution.mockReturnValue(null);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      expect(res.statusCode).toBe(404);
    });

    it('returns jobs with 1-based jobId', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);
      expect(body.jobs[0].jobId).toBe(1);
      expect(body.jobs[1].jobId).toBe(2);
    });

    it('falls back to task name when id is absent', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        jobs: [{ totalTime: 1.0, tasks: [{ name: 'TestByName' }] }],
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);
      expect(body.jobs[0].tests[0]).toBe('TestByName');
    });

    it('handles missing jobs array gracefully', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({ metrics: { criticalPath: 1.0 } });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);
      expect(body.jobs).toEqual([]);
    });
  });

  describe('GET /api/trends', () => {
    it('returns deltas in chronological order (oldest first)', async () => {
      const older = { ...mockDelta, createdAt: '2026-01-01T00:00:00.000Z' };
      const newer = { ...mockDelta, createdAt: '2026-01-02T00:00:00.000Z' };
      mockStore.loadHistoricalDeltas.mockReturnValue([newer, older]);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/trends' });
      const body = JSON.parse(res.body);
      expect(body.trends[0].runAt).toBe('2026-01-01T00:00:00.000Z');
      expect(body.trends[1].runAt).toBe('2026-01-02T00:00:00.000Z');
    });
  });
});
