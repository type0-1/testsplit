import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { TestSplitEngine, Algorithm } from '../../core/TestSplitEngine';
import { renderBar } from '../../utils/Terminal';
import { FileStore } from '../../storage/FileStore';
import { inspectReportPath } from '../../generator/ProjectInspection';
import { normalizeJobs, normalizeRiskFactor, assertJUnitPathExists } from '../utils/validation';
import { EXIT_FAILURE } from '../constants';

export function buildProfileCommand(y: Argv): Argv {
  return y
    .option('junit', {
      type: 'string',
      demandOption: false,
      describe: 'Path to JUnit XML file or directory (auto-detected if omitted)',
    })
    .option('jobs', {
      type: 'number',
      default: os.cpus().length,
      describe: 'Number of parallel jobs',
    })
    .option('data', {
      type: 'string',
      default: '.data',
      describe: 'Path to data directory',
    })
    .option('explain', {
      type: 'boolean',
      default: false,
      describe: 'Explain profiling results in plain English',
    })
    .option('algorithm', {
      type: 'string',
      choices: ['lpt', 'multifit'] as const,
      default: 'lpt',
      describe: 'Scheduling algorithm to use',
    })
    .option('risk-factor', {
      type: 'number',
      default: 1.0,
      describe:
        'Multiplier k for stdDev in variance-aware scheduling weight (meanDuration + k*stdDev)',
    });
}

export function handleProfileCommand(argv: any): void {
  const junitRaw = argv.junit as string | undefined;
  const junitPath = junitRaw
    ? path.resolve(junitRaw)
    : (() => {
        const detected = inspectReportPath();
        const dirs = detected.reportDirs;
        if (dirs.length === 0) {
          console.error(
            chalk.red(
              'Error: could not auto-detect report directory. Use --junit to specify one.',
            ),
          );
          process.exit(EXIT_FAILURE);
        }
        if (dirs.length > 1) {
          console.log(
            chalk.dim(
              `Auto-detected ${detected.tool} multi-module reports — merging ${dirs.length} directories`,
            ),
          );
        } else {
          console.log(
            chalk.dim(`Auto-detected ${detected.tool} reports at: ${dirs[0]}`),
          );
        }
        return dirs[0];
      })();
  const jobCount = normalizeJobs(argv.jobs);
  const dataDir = argv.data as string;
  const explain = argv.explain as boolean;
  const algorithm = argv.algorithm as Algorithm;
  const riskFactor = normalizeRiskFactor(
    (argv['risk-factor'] as number | undefined) ?? 1.0,
  );
  const availableCores = os.cpus().length;

  assertJUnitPathExists(junitPath);

  const engine = new TestSplitEngine(dataDir);
  const profileStart = performance.now();
  const { profile, distribution } = engine.run(
    junitPath,
    jobCount,
    true,
    algorithm,
    riskFactor,
  );
  const analysisMs = (performance.now() - profileStart).toFixed(1);

  try {
    const store = new FileStore();
    const deltas = {
      runAt: new Date().toISOString(),
      commit: profile.metadata?.commit?.sha ?? null,
      testCount: profile.testCount,
      totalDuration: profile.totalDuration,
      averageDuration: profile.averageDuration,
      criticalPath: distribution.metrics.criticalPath,
      balanceRatio: distribution.metrics.balanceRatio,
    };
    store.saveHistoricalDeltas(deltas);
  } catch {
    console.warn(chalk.yellow('Warning: failed to persist historical deltas'));
  }

  if (profile.testCount === 0) {
    console.error(
      chalk.red('Error: no test cases were parsed from the JUnit input'),
    );
    process.exit(EXIT_FAILURE);
  }

  const zeroDurationTests = profile.testResults.filter((t) => t.duration === 0);
  const m = distribution.metrics;

  const bottleneckTest =
    profile.testResults.length === 0
      ? null
      : profile.testResults.reduce((max, t) =>
          t.duration > max.duration ? t : max,
        );
  const predictedSpeedUp =
    m.criticalPath === 0 ? 1 : profile.totalDuration / m.criticalPath;

  let interpretation = '';
  if (bottleneckTest) {
    const dominantRatio = bottleneckTest.duration / profile.totalDuration;
    if (dominantRatio > 0.8) {
      interpretation =
        'Execution is dominated by a single long-running test, limiting achievable parallel speed-up.';
    } else if (m.balanceRatio > 2) {
      interpretation = 'Workload is unevenly distributed across jobs.';
    } else {
      interpretation = 'Workload is well balanced for parallel execution.';
    }
  }

  if (zeroDurationTests.length > 0) {
    console.log('Zero-duration tests');
    console.log('-------------------');
    console.log(`  ${zeroDurationTests.length} tests reported 0.00s execution time`);
    zeroDurationTests.slice(0, 5).forEach((t) => {
      console.log(`  - ${t.name}`);
    });
    if (zeroDurationTests.length > 5) {
      console.log(`  ...and ${zeroDurationTests.length - 5} more\n`);
    } else {
      console.log();
    }
  }

  console.log('Profile Summary');
  console.log('------------------------');
  console.log(`Tests parsed: ${profile.testCount}`);
  console.log(`Total duration: ${profile.totalDuration.toFixed(2)}s`);
  console.log(`Parallel jobs: ${distribution.jobCount}`);
  console.log(`Analysis time: ${analysisMs}ms\n`);

  console.log('Scheduling metrics');
  console.log('------------------');
  console.log(`Critical path: ${m.criticalPath.toFixed(2)}s`);
  console.log(`Predicted speed-up: ${predictedSpeedUp.toFixed(2)}×`);
  console.log(`Balance ratio: ${m.balanceRatio.toFixed(2)}\n`);

  const efficiency = ((jobCount / availableCores) * 100).toFixed(0);
  console.log('Core utilisation');
  console.log('----------------');
  console.log(`Available cores: ${availableCores}`);
  console.log(`Parallel jobs: ${jobCount}`);
  console.log(`Efficiency: ${efficiency}%\n`);

  console.log('Job distribution');
  console.log('----------------');

  const maxJobTime = Math.max(...distribution.jobs.map((j) => j.totalTime));
  const idealTime = profile.totalDuration / distribution.jobCount;

  distribution.jobs.forEach((job, i) => {
    const bar = renderBar(job.totalTime, maxJobTime);
    const diff = job.totalTime - idealTime;
    const sign = diff >= 0 ? '+' : '';
    const diffStr = `${sign}${diff.toFixed(2)}s vs ideal`;
    console.log(
      `Job ${i + 1}: ${job.totalTime.toFixed(2)}s ${bar} (${job.tasks.length} tests, ${diffStr})`,
    );
  });
  console.log();

  if (bottleneckTest) {
    console.log('Bottleneck test');
    console.log('---------------');
    console.log(`  ${bottleneckTest.name} (${bottleneckTest.duration.toFixed(2)}s)\n`);
  }

  if (explain && interpretation) {
    console.log('Interpretation');
    console.log('--------------');
    console.log(`${interpretation}\n`);
  }

  console.log(chalk.green('Profile completed successfully.'));
}
