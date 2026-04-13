import chalk from 'chalk';
import { Argv } from 'yargs';
import { FileStore } from '../../storage/FileStore';
import { HistoricalProfiler } from '../../profiler/core/HistoricalProfiler';
import { deltaStr, row } from '../utils/helpers';
import { EXIT_FAILURE, SEP, SECTION_WIDTH, COL_LABEL, COL_VALUE } from '../constants';

export function buildCompareCommand(y: Argv): Argv {
  return y
    .option('runs', {
      type: 'number',
      default: 2,
      describe: 'Number of recent runs to load',
    })
    .option('data', {
      type: 'string',
      default: '.data',
      describe: 'Path to data directory',
    })
    .option('threshold', {
      type: 'number',
      default: 10,
      describe: 'Regression threshold as a percentage (default: 10)',
    });
}

export function handleCompareCommand(argv: Record<string, unknown>): void {
  const runCount = argv.runs as number;
  const dataDir = argv.data as string;
  const thresholdPct = argv.threshold as number;

  const store = new FileStore(dataDir);
  const deltas = store.loadHistoricalDeltas(runCount);

  if (deltas.length === 0) {
    console.error(
      chalk.red('No historical runs found. Run `profile` at least once first.'),
    );
    process.exit(EXIT_FAILURE);
  }

  if (deltas.length < 2) {
    console.error(
      chalk.yellow('Only one run found - need at least 2 runs to compare.'),
    );
    process.exit(EXIT_FAILURE);
  }

  // loadHistoricalDeltas returns newest first, reverse for chronological order
  const sorted = [...deltas].reverse();
  const a = sorted[0].deltas;
  const b = sorted[sorted.length - 1].deltas;
  const aTime = sorted[0].createdAt;
  const bTime = sorted[sorted.length - 1].createdAt;

  console.log(`\nCompare - ${sorted.length} runs`);
  console.log(SEP);
  console.log(
    'Metric'.padEnd(COL_LABEL) +
      'Run A'.padStart(COL_VALUE) +
      'Run B'.padStart(COL_VALUE) +
      'Delta'.padStart(14),
  );
  console.log(SEP);

  console.log(
    'Run at'.padEnd(COL_LABEL) +
      aTime.slice(0, 19).padStart(COL_VALUE) +
      bTime.slice(0, 19).padStart(COL_VALUE),
  );

  const aCommit = a.commit ? a.commit.slice(0, 7) : '-';
  const bCommit = b.commit ? b.commit.slice(0, 7) : '-';
  console.log(
    'Commit'.padEnd(COL_LABEL) +
      aCommit.padStart(COL_VALUE) +
      bCommit.padStart(COL_VALUE),
  );

  console.log(SEP);

  row('Tests', String(a.testCount), String(b.testCount), deltaStr(a.testCount, b.testCount, '', false));
  row('Total duration', `${a.totalDuration.toFixed(2)}s`, `${b.totalDuration.toFixed(2)}s`, deltaStr(a.totalDuration, b.totalDuration, 's', true));
  row('Avg duration', `${a.averageDuration.toFixed(2)}s`, `${b.averageDuration.toFixed(2)}s`, deltaStr(a.averageDuration, b.averageDuration, 's', true));
  row('Critical path', `${a.criticalPath.toFixed(2)}s`, `${b.criticalPath.toFixed(2)}s`, deltaStr(a.criticalPath, b.criticalPath, 's', true));
  row('Balance ratio', a.balanceRatio.toFixed(3), b.balanceRatio.toFixed(3), deltaStr(a.balanceRatio, b.balanceRatio, '', true));

  console.log(SEP);

  const threshold = thresholdPct / 100;
  const regressions = HistoricalProfiler.detectRegressions(deltas, threshold);

  console.log(`\nRegression check (threshold: ${thresholdPct}%)`);
  console.log('─'.repeat(SECTION_WIDTH));

  if (regressions.length === 0) {
    console.log(chalk.green('No regressions detected.'));
  } else {
    for (const flag of regressions) {
      const label = flag.metric === 'criticalPath' ? 'Critical path' : 'Balance ratio';
      const pct = (flag.changePercent * 100).toFixed(1);
      const avg =
        flag.metric === 'criticalPath'
          ? `${flag.rollingAverage.toFixed(2)}s`
          : flag.rollingAverage.toFixed(3);
      const curr =
        flag.metric === 'criticalPath'
          ? `${flag.current.toFixed(2)}s`
          : flag.current.toFixed(3);
      console.log(chalk.red(`REGRESSION ${label}: ${avg} --> ${curr} (+${pct}%)`));
    }
  }
  console.log();
}
