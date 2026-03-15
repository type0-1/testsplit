import Fastify from 'fastify';
import cors from '@fastify/cors';
import { FileStore } from '../storage/FileStore';
import { HistoricalTestStats } from '../models/HistoricalTestStats';

export async function buildApp() {
  const app = Fastify();
  const store = new FileStore();
  const defaultCorsOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
    : defaultCorsOrigins;

  await app.register(cors, { origin: corsOrigin });

  // Endpoint to get summary stats
  app.get('/api/summary', async (_req, reply) => {
    const historical = store.loadHistoricalProfile();
    const distribution = store.loadLatestDistribution() as any;
    const deltas = store.loadHistoricalDeltas(1);
    const latest = deltas[0]?.deltas ?? null;

    if (!historical && !latest) {
      return reply.status(404).send({ error: 'No profiling data found. Run: testsplit profile --junit <path>' });
    }

    const perTestStats = historical
      ? (Object.values(historical.perTestStats) as HistoricalTestStats[])
      : [];

    return {
      totalTests: perTestStats.length > 0 ? perTestStats.length : (latest?.testCount ?? 0),
      runCount: historical?.runCount ?? 0,
      avgDuration: historical?.averageTestDuration ?? latest?.averageDuration ?? 0,
      unstableCount: perTestStats.filter(t => t.unstable).length,
      outlierCount: perTestStats.filter(t => t.isOutlier).length,
      makespan: distribution?.metrics?.criticalPath ?? 0,
      speedupFactor: latest && distribution?.metrics?.criticalPath ? latest.totalDuration / distribution.metrics.criticalPath : 1,
      balanceRatio: distribution?.metrics?.balanceRatio ?? 1,
      sequentialDuration: latest?.totalDuration ?? 0,
    };
  });

  // Endpoint to get per-test stats with sorting and pagination
  app.get('/api/tests', async (req, reply) => {
    const historical = store.loadHistoricalProfile();

    if (!historical) {
      return reply.status(404).send({ error: 'No profiling data found. Run: testsplit profile --junit <path>' });
    }

    const { sort = 'duration', limit = '100', offset = '0' } = req.query as Record<string, string>;
    const limitN = Math.min(parseInt(limit, 10) || 100, 500);
    const offsetN = parseInt(offset, 10) || 0;

    const tests = Object.values(historical.perTestStats) as HistoricalTestStats[];

    if (sort === 'cv') {
      tests.sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation);
    } else if (sort === 'name') {
      tests.sort((a, b) => a.testName.localeCompare(b.testName));
    } else {
      tests.sort((a, b) => b.meanDuration - a.meanDuration);
    }

    return {
      total: tests.length,
      limit: limitN,
      offset: offsetN,
      tests: tests.slice(offsetN, offsetN + limitN),
    };
  });

  // Endpoint to get job distribution
  app.get('/api/jobs', async (_req, reply) => {
    const distribution = store.loadLatestDistribution() as any;

    if (!distribution) {
      return reply.status(404).send({ error: 'No distribution data found. Run: testsplit profile --junit <path>' });
    }

    return {
      jobs: (distribution.jobs ?? []).map((job: any, i: number) => ({
        jobId: i + 1,
        totalTime: job.totalTime,
        tests: (job.tasks ?? []).map((t: any) => t.id ?? t.name ?? t),
      })),
      metrics: distribution.metrics ?? {},
    };
  });

  // Endpoint to get trends over time
  app.get('/api/trends', async (req) => {
    const { limit = '20' } = req.query as Record<string, string>;
    const limitN = Math.min(parseInt(limit, 10) || 20, 100);
    const deltas = store.loadHistoricalDeltas(limitN);

    return {
      trends: deltas
        .map(d => ({
          runAt: d.createdAt,
          totalDuration: d.deltas.totalDuration,
          averageDuration: d.deltas.averageDuration,
          testCount: d.deltas.testCount,
          criticalPath: d.deltas.criticalPath,
          balanceRatio: d.deltas.balanceRatio,
        }))
        .reverse(),
    };
  });

  return app;
}

async function start() {
  const app = await buildApp();
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API server running on http://localhost:${port}`);
}

if (require.main === module) {
  start().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
