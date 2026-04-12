import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { TestSplitEngine, Algorithm } from '../core/TestSplitEngine';
import {
  runAllJobs,
  runAllJobsDynamic,
  runAllJobsWorkStealing,
} from '../runner/ParallelRunner';
import {
  assertJUnitPathExists,
  normalizeJobs,
  normalizeRiskFactor,
} from '../utils/validation';
import { EXIT_FAILURE } from '../constants';

export function buildRunCommand(y: Argv): Argv {
  return y
    .option('junit', {
      type: 'string',
      demandOption: true,
      describe: 'Path to JUnit XML test report',
    })
    .option('jobs', {
      type: 'number',
      default: os.cpus().length,
      describe: 'Number of parallel jobs to spawn',
    })
    .option('data', {
      type: 'string',
      default: '.data',
      describe: 'Path to data directory for profiling artifacts',
    })
    .option('cmd', {
      type: 'string',
      demandOption: true,
      describe: 'Base test command (e.g. "npx jest" or "mvn test -Dtest")',
    })
    .option('filter-flag', {
      type: 'string',
      default: '--testNamePattern',
      describe: 'Flag used to pass a test filter to the test runner',
    })
    .option('filter-join', {
      type: 'string',
      default: '|',
      describe: 'Separator used to join multiple test names into one filter value',
    })
    .option('algorithm', {
      type: 'string',
      choices: ['lpt', 'multifit'] as const,
      default: 'lpt',
      describe: 'Scheduling algorithm',
    })
    .option('risk-factor', {
      type: 'number',
      default: 1.0,
      describe: 'Variance weight k: schedules using meanDuration + k * stdDev',
    })
    .option('dynamic', {
      type: 'boolean',
      default: false,
      describe:
        'Enable dynamic work queue: workers pull the next test when idle instead of going idle',
    })
    .option('steal', {
      type: 'boolean',
      default: false,
      describe:
        'Enable work stealing: idle workers steal the largest task from the busiest peer',
    })
    .option('affinity', {
      type: 'boolean',
      default: false,
      describe:
        'Pin each worker to a distinct least-loaded CPU core (Linux: taskset, other platforms: no-op)',
    });
}

export async function handleRunCommand(argv: any): Promise<void> {
  const junitPath = path.resolve(argv.junit as string);
  const jobCount = normalizeJobs(argv.jobs);
  const dataDir = argv.data as string;
  const cmd = argv.cmd as string;
  const filterFlag = argv['filter-flag'] as string;
  const filterJoin = argv['filter-join'] as string;
  const algorithm = argv.algorithm as Algorithm;
  const riskFactor = normalizeRiskFactor(argv['risk-factor']);
  const dynamic = argv.dynamic as boolean;
  const steal = argv.steal as boolean;
  const affinity = argv.affinity as boolean;

  assertJUnitPathExists(junitPath);

  const engine = new TestSplitEngine(dataDir);
  const { distribution } = engine.run(
    junitPath,
    jobCount,
    true,
    algorithm,
    riskFactor,
  );

  console.log(
    chalk.bold(
      `\nSpawning ${distribution.jobs.length} job(s) using ${algorithm.toUpperCase()}...\n`,
    ),
  );

  const activeCount = distribution.jobs.filter((j) => j.tasks.length > 0).length;
  const coreIds = affinity
    ? await (await import('../runner/CoreAffinity')).getLeastLoadedCores(activeCount)
    : undefined;
  if (affinity && coreIds) {
    console.log(
      chalk.dim(`Core affinity: pinning workers to cores [${coreIds.join(', ')}]`),
    );
  }

  const results = await (steal
    ? runAllJobsWorkStealing(distribution.jobs, cmd, filterFlag)
    : dynamic
      ? runAllJobsDynamic(distribution.jobs, cmd, filterFlag)
      : runAllJobs(distribution.jobs, cmd, filterFlag, filterJoin, coreIds));

  let allPassed = true;
  for (const r of results) {
    const status = r.exitCode === 0 ? chalk.green('PASS') : chalk.red('FAIL');
    console.log(
      `Job ${r.jobId}  ${status}  ${r.wallClockMs.toFixed(0)}ms  (${r.testNames.length} tests)`,
    );
    if (r.exitCode !== 0) allPassed = false;
  }

  const maxWall = Math.max(...results.map((r) => r.wallClockMs));
  console.log(chalk.bold(`\nCritical path (slowest job): ${maxWall.toFixed(0)}ms`));

  try {
    const { persistObservedTimings } = await import('../runner/TimingFeedback');
    persistObservedTimings(results, distribution.jobs);
    console.log(chalk.dim('Observed timings fed back into profiler for future runs.'));
  } catch {
    console.warn(chalk.yellow('Warning: failed to persist observed timings'));
  }

  if (!allPassed) process.exit(EXIT_FAILURE);
}
