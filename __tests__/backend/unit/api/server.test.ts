import { buildApp } from '../../../../src/backend/api/server';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import fs from 'fs';
import path from 'path';

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
  const originalCorsOrigin = process.env.CORS_ORIGIN;
  const frontendDist = path.resolve(__dirname, '../../../../src/frontend/dist');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CORS_ORIGIN = originalCorsOrigin;
    fs.rmSync(frontendDist, { recursive: true, force: true });
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

  afterAll(() => {
    process.env.CORS_ORIGIN = originalCorsOrigin;
    fs.rmSync(frontendDist, { recursive: true, force: true });
  });

  describe('CORS config', () => {
    it('uses trimmed CORS_ORIGIN list when environment variable is set', async () => {
      process.env.CORS_ORIGIN = ' https://allowed.example.com , , http://localhost:9999 ';
      const app = await buildApp();
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'https://allowed.example.com',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe('https://allowed.example.com');
    });

    it('uses default localhost origins when CORS_ORIGIN is unset', async () => {
      delete process.env.CORS_ORIGIN;
      const app = await buildApp();
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('static frontend branch', () => {
    it('serves frontend index.html via notFound handler when dist exists', async () => {
      fs.mkdirSync(frontendDist, { recursive: true });
      fs.writeFileSync(
        path.join(frontendDist, 'index.html'),
        '<!doctype html><html><body>frontend app</body></html>',
        'utf-8',
      );

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/client/route' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('frontend app');
    });
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

    it('uses latest averageDuration when historical profile is missing', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);

      expect(body.runCount).toBe(0);
      expect(body.avgDuration).toBe(mockDelta.deltas.averageDuration);
      expect(body.sequentialDuration).toBe(mockDelta.deltas.totalDuration);
    });

    it('uses computed speedupFactor when latest and criticalPath are available', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        metrics: { criticalPath: 2, balanceRatio: 1.5 },
      });
      mockStore.loadHistoricalDeltas.mockReturnValue([
        {
          ...mockDelta,
          deltas: {
            ...mockDelta.deltas,
            totalDuration: 8,
          },
        },
      ]);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);

      expect(body.speedupFactor).toBe(4);
      expect(body.makespan).toBe(2);
      expect(body.balanceRatio).toBe(1.5);
    });

    it('returns all summary fields with historical values taking precedence', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue({
        ...mockHistorical,
        runCount: 7,
        averageTestDuration: 9.9,
      } as any);
      mockStore.loadHistoricalDeltas.mockReturnValue([
        {
          ...mockDelta,
          deltas: {
            ...mockDelta.deltas,
            testCount: 999,
            averageDuration: 123,
            totalDuration: 20,
          },
        },
      ]);
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        metrics: { criticalPath: 4, balanceRatio: 1.25 },
      } as any);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);

      expect(body).toEqual({
        totalTests: 3,
        runCount: 7,
        avgDuration: 9.9,
        unstableCount: 1,
        outlierCount: 1,
        makespan: 4,
        speedupFactor: 5,
        balanceRatio: 1.25,
        sequentialDuration: 20,
        cpuCores: null,
      });
    });

    it('uses default metric fallbacks when distribution is missing', async () => {
      mockStore.loadLatestDistribution.mockReturnValue(null);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);

      expect(body.makespan).toBe(0);
      expect(body.speedupFactor).toBe(1);
      expect(body.balanceRatio).toBe(1);
    });

    it('falls back to zero summary values when latest payload has no fields', async () => {
      mockStore.loadHistoricalProfile.mockReturnValue(null);
      mockStore.loadLatestDistribution.mockReturnValue(null);
      mockStore.loadHistoricalDeltas.mockReturnValue([
        { createdAt: '2026-01-01T00:00:00.000Z', deltas: {} as any } as any,
      ]);

      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/summary' });
      const body = JSON.parse(res.body);

      expect(body.totalTests).toBe(0);
      expect(body.avgDuration).toBe(0);
      expect(body.sequentialDuration).toBe(0);
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

    it('maps totalTime and test ids from distribution jobs', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.jobs[0].totalTime).toBe(3.0);
      expect(body.jobs[0].tests).toEqual(['com.example.TestA']);
      expect(body.jobs[1].totalTime).toBe(3.0);
      expect(body.jobs[1].tests).toEqual(['com.example.TestB', 'com.example.TestC']);
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

    it('falls back to raw task value when id and name are absent', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        jobs: [{ totalTime: 1.0, tasks: ['plain-task'] }],
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.jobs[0].tests[0]).toBe('plain-task');
    });

    it('falls back to String(task) when task object has no id or name', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        jobs: [{ totalTime: 1.0, tasks: [{}] }],
      });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.jobs[0].tests[0]).toBe('[object Object]');
    });

    it('falls back to String(task) when id and name are explicitly null', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        ...mockDistribution,
        jobs: [{ totalTime: 1.0, tasks: [{ id: null, name: null }] }],
      } as any);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.jobs[0].tests[0]).toBe('[object Object]');
    });

    it('handles missing jobs array gracefully', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({ metrics: { criticalPath: 1.0 } });
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);
      expect(body.jobs).toEqual([]);
      expect(body.metrics).toEqual({ criticalPath: 1.0 });
    });

    it('uses empty tests array when a job has no tasks', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        metrics: { criticalPath: 1.0 },
        jobs: [{ totalTime: 1.0 }],
      } as any);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.jobs[0]).toEqual({
        jobId: 1,
        totalTime: 1.0,
        tests: [],
      });
    });

    it('defaults metrics to empty object when missing', async () => {
      mockStore.loadLatestDistribution.mockReturnValue({
        jobs: [{ totalTime: 2.5, tasks: [{ id: 'T1' }] }],
      } as any);
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/jobs' });
      const body = JSON.parse(res.body);

      expect(body.metrics).toEqual({});
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

    it('clamps limit to 100 when query limit is too high', async () => {
      const app = await buildApp();
      await app.inject({ method: 'GET', url: '/api/trends?limit=500' });

      expect(mockStore.loadHistoricalDeltas).toHaveBeenCalledWith(100);
    });

    it('defaults limit to 20 when query limit is invalid', async () => {
      const app = await buildApp();
      await app.inject({ method: 'GET', url: '/api/trends?limit=abc' });

      expect(mockStore.loadHistoricalDeltas).toHaveBeenCalledWith(20);
    });
  });
});
