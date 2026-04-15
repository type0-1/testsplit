import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { Argv } from 'yargs';
import { TestSplitEngine } from '../../core/TestSplitEngine';
import { assertJUnitPathExists, normalizeJobs } from '../utils/validation';
import { BENCH_SEP, DELTA_ARROW, EXIT_FAILURE } from '../constants';

export function buildBenchmarkCommand(y: Argv): Argv {
  return y
    .option('junit', {
      type: 'string',
      demandOption: true,
      describe: 'Path to JUnit XML file or directory',
    })
    .option('jobs', {
      type: 'number',
      default: os.cpus().length,
      describe: 'Number of parallel jobs',
    });
}

<<<<<<< HEAD
export function handleBenchmarkCommand(argv: Record<string, unknown>): void {
  const junitPath = path.resolve(argv.junit as string);
  const jobCount = normalizeJobs(argv.jobs as number | undefined);
=======
export function handleBenchmarkCommand(argv: any): void {
  const junitPath = path.resolve(argv.junit as string);
  const jobCount = normalizeJobs(argv.jobs);
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527

  assertJUnitPathExists(junitPath);

  const benchEngine = new TestSplitEngine();
  const benchStart = performance.now();
  const { profile, distribution } = benchEngine.run(junitPath, jobCount, false);
  const benchMs = (performance.now() - benchStart).toFixed(1);

  if (profile.testCount === 0) {
    console.error(
      chalk.red('Error: no test cases were parsed from the JUnit input'),
    );
    process.exit(EXIT_FAILURE);
  }

  const sequential = profile.totalDuration;
  const parallel = distribution.metrics.criticalPath;
  const speedup = parallel === 0 ? 1 : sequential / parallel;
  const timeSaved = sequential - parallel;
  const timeSavedPct = sequential === 0 ? 0 : (timeSaved / sequential) * 100;

  console.log('\nBenchmark Report');
  console.log(BENCH_SEP);
  console.log(`Tests: ${profile.testCount}`);
  console.log(`Jobs: ${jobCount}`);
  console.log(BENCH_SEP);

  console.log('Sequential stage');
  console.log(`  ${sequential.toFixed(2)}s`);

  console.log(`Parallel stage (${DELTA_ARROW} predicted)`);
  console.log(`  ${parallel.toFixed(2)}s`);

  console.log('Delta report');
  console.log(`  Time saved: ${timeSaved.toFixed(2)}s  (${timeSavedPct.toFixed(1)}%)`);
<<<<<<< HEAD
  console.log(`Speedup: ${speedup.toFixed(2)}×`);
=======
  console.log(`Speedup: ${speedup.toFixed(2)}x`);
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
  console.log(`Balance ratio: ${distribution.metrics.balanceRatio.toFixed(3)}`);
  console.log(BENCH_SEP);
  console.log(`Analysis time: ${benchMs}ms`);
  console.log();
}
