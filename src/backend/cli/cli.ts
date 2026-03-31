#!/usr/bin/env node

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../..', 'package.json'), 'utf-8'),
) as { version: string };

function getCustomHelp(): string {
  const title = chalk.bold('testsplit');
  const version = `v${packageJson.version}`;
  const desc =
    'Test distribution and scheduling engine for parallel CI/CD pipelines';

  const commands = [
    {
      name: 'profile',
      desc: 'Profile tests and display scheduling metrics',
    },
    {
      name: 'generate|generate-config',
      desc: 'Generate CI configuration from test profile',
    },
    {
      name: 'run',
      desc: 'Schedule and execute test subsets in parallel',
    },
    {
      name: 'benchmark',
      desc: 'Run benchmark report (sequential → parallel → delta)',
    },
    {
      name: 'compare',
      desc: 'Compare recent profiling runs and detect regressions',
    },
    {
      name: 'validate',
      desc: 'Validate a generated CI configuration file',
    },
    {
      name: 'dashboard',
      desc: 'Start API + frontend dashboard and open in browser',
    },
  ];

  let output = `\n${title} ${chalk.dim(version)}\n${desc}\n\n`;
  output += chalk.bold('Usage:\n');
  output += `  testsplit <command> [options]\n\n`;

  output += chalk.bold('Commands:\n');
  const maxLen = Math.max(...commands.map((c) => c.name.length));
  commands.forEach((cmd) => {
    output += `  ${cmd.name.padEnd(maxLen)}  ${cmd.desc}\n`;
  });

  output += `\n${chalk.bold('Global Options:')}\n`;
  output += `  --help        Show this help message\n`;
  output += `  --version     Show version number\n\n`;
  output += chalk.dim(`Run 'testsplit <command> --help' for command-specific options\n`);

  return output;
}

import { TestSplitEngine, Algorithm } from '../core/TestSplitEngine';
import { runAllJobs, runAllJobsDynamic, runAllJobsWorkStealing } from '../runner/ParallelRunner';
import { renderBar } from '../utils/Terminal';
import { FileStore } from '../storage/FileStore';
import { HistoricalProfiler } from '../profiler/core/HistoricalProfiler';
import { generateDockerfile } from '../generator/DockerfileGenerator';
import { parsePom } from '../detector/PomParser';
import { runDetection } from '../core/DetectionOrchestrator';
import { findExistingCIFile, findTestJobs, extractTestCommands } from './CIConfigReader';
import { buildGitHubPhasedJobs } from '../generator/GitHubActionsGenerator';
import { buildGitLabSplitJobs } from '../generator/GitLabCIGenerator';
import { buildJobsWithDependencies, groupSlotsIntoRunners } from '../generator/JobBuilder';
import { getSchemaValidator } from '../generator/getSchemaValidator';
import { validateYamlSyntax } from '../generator/YAMLSyntaxValidator';
import YAML from 'yaml';
import chalk from 'chalk';

type Platform = 'github' | 'gitlab';
const EXIT_FAILURE = 1;

const TABLE_WIDTH = 66;
const SECTION_WIDTH = 40;
const COL_LABEL = 18;
const COL_VALUE = 18;
const COL_DELTA = 14;
const SEP = '-'.repeat(TABLE_WIDTH);

function resolveJUnitPath(input: unknown): string {
  return path.resolve(input as string);
}

function normalizeJobs(input: unknown): number {
  let jobCount = Number(input);

  if (!Number.isInteger(jobCount) || jobCount <= 0) {
    console.error(chalk.red('Error: --jobs must be a positive integer'));
    process.exit(EXIT_FAILURE);
  }

  const availableCores = os.cpus().length;
  if (jobCount > availableCores) {
    console.warn(
      chalk.yellow(
        `Warning: --jobs ${jobCount} exceeds available cores (${availableCores}). Capping to ${availableCores}.`,
      ),
    );
    jobCount = availableCores;
  }

  return jobCount;
}

function normalizeRiskFactor(input: unknown): number {
  const riskFactor = Number(input);
  if (!Number.isFinite(riskFactor) || riskFactor < 0) {
    console.error(
      chalk.red('Error: --risk-factor must be a non-negative number'),
    );
    process.exit(EXIT_FAILURE);
  }

  return riskFactor;
}

function assertJUnitPathExists(junitPath: string): void {
  if (!fs.existsSync(junitPath)) {
    console.error(chalk.red(`Error: JUnit path does not exist: ${junitPath}`));
    process.exit(EXIT_FAILURE);
  }
}

function prependSchedulingHeader(
  yaml: string,
  algorithm: Algorithm,
  riskFactor: number,
): string {
  const header = [
    '# Scheduling settings used for this distribution',
    `# algorithm: ${algorithm}`,
    `# risk_factor: ${riskFactor}`,
    '',
  ].join('\n');

  return `${header}${yaml}`;
}

function validateFinalCIConfig(yaml: string, platform: Platform): void {
  try {
    validateYamlSyntax(yaml);

    const schemaValidator = getSchemaValidator(platform);
    schemaValidator?.validate(yaml);
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Final ${platform} CI config validation failed: ${details}`,
      { cause: err },
    );
  }
}

function openInBrowser(url: string): void {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
      return;
    }

    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
      }).unref();
      return;
    }

    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // Browser launch failure should not block dashboard startup.
  }
}

// Intercept --help early to show custom help
const args = hideBin(process.argv);
if (args.includes('--help') || args.includes('-h')) {
  if (args.length === 1 || (args.length === 2 && (args[0] === '--help' || args[0] === '-h'))) {
    // Top-level help, not command-specific
    console.log(getCustomHelp());
    process.exit(0);
  }
}

yargs(args)
  .command(
    'profile',
    'Profile tests and display scheduling metrics',
    (y) =>
      y
        .option('junit', {
          type: 'string',
          demandOption: true,
          describe: 'Path to JUnit XML file or directory',
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
        }),
    (argv) => {
      const junitPath = path.resolve(argv.junit as string);
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
        // Persistence failures should never break profiling
        console.warn(
          chalk.yellow('Warning: failed to persist historical deltas'),
        );
      }

      if (profile.testCount === 0) {
        console.error(
          chalk.red('Error: no test cases were parsed from the JUnit input'),
        );
        process.exit(EXIT_FAILURE);
      }

      const zeroDurationTests = profile.testResults.filter(
        (t) => t.duration === 0,
      );
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
        console.log(
          `  ${zeroDurationTests.length} tests reported 0.00s execution time`,
        );

        // Show the first five results obtained
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
        console.log(
          `  ${bottleneckTest.name} (${bottleneckTest.duration.toFixed(2)}s)\n`,
        );
      }

      if (explain && interpretation) {
        console.log('Interpretation');
        console.log('--------------');
        console.log(`${interpretation}\n`);
      }

      console.log(chalk.green('Profile completed successfully.'));
    },
  )
  .command(
    ['generate', 'generate-config'],
    'Generate CI configuration from test profile',
    (y) =>
      y
        .option('junit', {
          type: 'string',
          demandOption: true,
          describe: 'Path to JUnit XML file or directory',
        })
        .option('jobs', {
          type: 'number',
          describe: 'Number of parallel jobs (defaults to --runner-cores)',
        })
        .option('runner-cores', {
          type: 'number',
          default: 2,
          describe: 'Number of CPU cores per CI runner (default: 2 for GitHub Actions / GitLab)',
        })
        .option('platform', {
          type: 'string',
          choices: ['github', 'gitlab'],
          default: 'github',
        })
        .option('out', {
          type: 'string',
          default: 'testsplit.yml',
        })
        .option('template', {
          type: 'string',
          describe:
            'Path to an existing CI YAML template to inject split jobs into',
        })
        .option('data', {
          type: 'string',
          default: '.data',
          describe: 'Path to persisted profiling data directory',
        })
        .option('maven-bin', {
          type: 'string',
          default: 'mvn',
          describe: 'Maven executable to run tests (e.g., mvn or ./mvnw)',
        })
        .option('from', {
          type: 'string',
          describe: 'Path to existing CI config file to use as base (overrides auto-detection)',
        })
        .option('dry-run', {
          type: 'boolean',
          default: false,
          describe: 'Print CI config without writing files',
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
        })
        .option('artifact-path', {
          type: 'string',
          default: 'target/',
          describe:
            'Path to upload as build artifact when using --split-phases (default: target/ for standard Maven)',
        })
        .option('src', {
          type: 'string',
          default: 'src/test/java',
          describe: 'Path to Java test sources for dependency detection (default: src/test/java)',
        }),
    (argv) => {
      const junitPath = resolveJUnitPath(argv.junit);
      const runnerCores = argv['runner-cores'] as number;
      const jobCount = (argv.jobs as number | undefined) ?? runnerCores;
      const platform = argv.platform as Platform;
      const algorithm = argv.algorithm as Algorithm;
      const riskFactor = argv['risk-factor'] as number;
      const artifactPath = argv['artifact-path'] as string;
      const outPath = path.resolve(argv.out as string);
      const outDir = path.dirname(outPath);
      const templatePathArg = argv.template as string | undefined;
      const dataDir = argv.data as string;
      const mavenBin = (argv['maven-bin'] as string) ?? 'mvn';
      const dryRun = argv['dry-run'] as boolean;

      const fromFlag = argv['from'] as string | undefined;
      const existingCIPath = fromFlag ? path.resolve(fromFlag) : findExistingCIFile(platform);

      if (!existingCIPath) {
        console.error(chalk.red('No CI config found. Use --from <path> to specify one.'));
        process.exit(EXIT_FAILURE);
      }

      if (!fs.existsSync(existingCIPath)) {
        console.error(chalk.red(`Error: CI config file does not exist: ${existingCIPath}`));
        process.exit(EXIT_FAILURE);
      }

      const existingCIConfig = YAML.parse(fs.readFileSync(existingCIPath, 'utf-8'));

      if (!fs.existsSync(outDir)) {
        console.error(
          chalk.red(`Error: output directory does not exist: ${outDir}`),
        );
        process.exit(EXIT_FAILURE);
      }

      if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
        console.error(
          chalk.red('Error: --out must be a file path, not a directory'),
        );
        process.exit(EXIT_FAILURE);
      }

      // Argument validation
      assertJUnitPathExists(junitPath);

      const srcDir = path.resolve((argv.src as string | undefined) ?? 'src/test/java');
      const { containerImage, dependencyMap, lifecycle } = runDetection(
        path.resolve('.'),
        srcDir,
        path.resolve('testng-suite.xml'),
        path.resolve('pom.xml'),
      );

      if (containerImage) {
        console.log(chalk.dim(`Dockerfile detected, using container: ${containerImage}`));
      }
      if (dependencyMap && dependencyMap.size > 0) {
        console.log(chalk.dim(`  Found ${dependencyMap.size} test(s) with declared dependencies`));
      }
      if (lifecycle.hasDockerCompose) {
        console.log(chalk.dim('  docker-compose.yml detected — startup steps will be injected'));
      } else if (lifecycle.requirements.length > 0) {
        const types = lifecycle.requirements.map((r) => r.type).join(', ');
        console.log(chalk.dim(`  Detected services: ${types}`));
      }

      // Main logic with error handling
      try {
        const engine = new TestSplitEngine();
        /*
          When runnerCores > 1 we schedule jobCount*runnerCores virtual slots so LPT can balance at sub-runner granularity, then group them back into
          jobCount runners (NxM -> N).
        */
        const totalSlots = runnerCores > 1 ? jobCount * runnerCores : jobCount;
        const result = engine.run(junitPath, totalSlots, false, algorithm, riskFactor, dependencyMap);
        const jobs = runnerCores > 1 ? groupSlotsIntoRunners(result.distribution.jobs, runnerCores) : buildJobsWithDependencies(result.distribution.jobs);

        const testJobs = findTestJobs(existingCIConfig, platform);
        if (testJobs.length === 0) {
          throw new Error('No test jobs found in existing CI config');
        }

        const commands = extractTestCommands(existingCIConfig, platform, testJobs);
        const testCommand = commands[0] ?? `${mavenBin} test -Dtest=`;

        let ciConfig: string;

        if (platform === 'github') {
          const baseJobName = testJobs[0];
          const baseJob = existingCIConfig.jobs?.[baseJobName];
          if (!baseJob) {
            throw new Error('Unable to locate base GitHub test job');
          }

          const generatedJobs = buildGitHubPhasedJobs(baseJob, jobs, mavenBin, 'build-artifacts', artifactPath, runnerCores, containerImage, lifecycle.requirements.length > 0 ? lifecycle.requirements : undefined, lifecycle.hasDockerCompose);
          for (const jobName of testJobs) {
            delete existingCIConfig.jobs?.[jobName];
          }
          existingCIConfig.jobs = {
            ...(existingCIConfig.jobs ?? {}),
            ...generatedJobs,
          };
          ciConfig = YAML.stringify(existingCIConfig);
        } else {
          const baseJobName = testJobs[0];
          const baseJob = existingCIConfig[baseJobName];
          if (!baseJob) {
            throw new Error('Unable to locate base GitLab test job');
          }

          const splitJobs = buildGitLabSplitJobs(baseJob, jobs, testCommand, runnerCores, containerImage, lifecycle.requirements.length > 0 ? lifecycle.requirements : undefined, lifecycle.hasDockerCompose);
          for (const jobName of testJobs) {
            delete existingCIConfig[jobName];
          }
          Object.assign(existingCIConfig, splitJobs);
          ciConfig = YAML.stringify(existingCIConfig);
        }

        const outputConfig = prependSchedulingHeader(
          ciConfig,
          algorithm,
          riskFactor,
        );

        validateFinalCIConfig(outputConfig, platform);

        if (dryRun) {
          process.stdout.write(outputConfig);
        } else {
          fs.writeFileSync(outPath, outputConfig, 'utf-8');
          console.log(`CI configuration written to ${outPath}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Dependency cycle')) {
          console.error(chalk.red('Error: dependency cycle detected in test ordering.'));
          console.error(chalk.yellow('Check @Order, @DependsOnMethods, or testng-suite.xml for circular dependencies.'));
          console.error(chalk.yellow(`Use --src to point to a different source root, or remove the circular dependency.`));
        } else {
          console.error(chalk.red('Error: failed to generate CI configuration'));
          console.error(chalk.red(msg));
        }

        process.exit(EXIT_FAILURE);
      }
    },
  )
  .command(
    'compare',
    'Compare recent profiling runs and detect regressions',
    (y) =>
      y
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
        }),
    (argv) => {
      const runCount = argv.runs as number;
      const dataDir = argv.data as string;
      const thresholdPct = argv.threshold as number;

      const store = new FileStore(dataDir);
      const deltas = store.loadHistoricalDeltas(runCount);

      if (deltas.length === 0) {
        console.error(
          chalk.red(
            'No historical runs found. Run `profile` at least once first.',
          ),
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

      function deltaStr(
        prev: number,
        curr: number,
        unit: string,
        lowerIsBetter: boolean,
      ): string {
        const diff = curr - prev;
        const sign = diff >= 0 ? '+' : '';
        const str = `${sign}${diff.toFixed(2)}${unit}`;
        if (diff === 0) return str;
        const improved = lowerIsBetter ? diff < 0 : diff > 0;
        return improved ? chalk.green(str) : chalk.red(str);
      }

      function row(
        label: string,
        valA: string,
        valB: string,
        delta: string,
      ): void {
        console.log(
          label.padEnd(COL_LABEL) +
            valA.padStart(COL_VALUE) +
            valB.padStart(COL_VALUE) +
            delta.padStart(COL_DELTA),
        );
      }

      console.log(`\nCompare - ${sorted.length} runs`);
      console.log(SEP);
      console.log(
        'Metric'.padEnd(COL_LABEL) +
          'Run A'.padStart(COL_VALUE) +
          'Run B'.padStart(COL_VALUE) +
          'Delta'.padStart(COL_DELTA),
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

      row(
        'Tests',
        String(a.testCount),
        String(b.testCount),
        deltaStr(a.testCount, b.testCount, '', false),
      );
      row(
        'Total duration',
        `${a.totalDuration.toFixed(2)}s`,
        `${b.totalDuration.toFixed(2)}s`,
        deltaStr(a.totalDuration, b.totalDuration, 's', true),
      );
      row(
        'Avg duration',
        `${a.averageDuration.toFixed(2)}s`,
        `${b.averageDuration.toFixed(2)}s`,
        deltaStr(a.averageDuration, b.averageDuration, 's', true),
      );
      row(
        'Critical path',
        `${a.criticalPath.toFixed(2)}s`,
        `${b.criticalPath.toFixed(2)}s`,
        deltaStr(a.criticalPath, b.criticalPath, 's', true),
      );
      row(
        'Balance ratio',
        a.balanceRatio.toFixed(3),
        b.balanceRatio.toFixed(3),
        deltaStr(a.balanceRatio, b.balanceRatio, '', true),
      );

      console.log(SEP);

      const threshold = thresholdPct / 100;
      const regressions = HistoricalProfiler.detectRegressions(
        deltas,
        threshold,
      );

      console.log(`\nRegression check (threshold: ${thresholdPct}%)`);
      console.log('─'.repeat(SECTION_WIDTH));

      if (regressions.length === 0) {
        console.log(chalk.green('No regressions detected.'));
      } else {
        for (const flag of regressions) {
          const label =
            flag.metric === 'criticalPath' ? 'Critical path' : 'Balance ratio';
          const pct = (flag.changePercent * 100).toFixed(1);
          const avg =
            flag.metric === 'criticalPath'
              ? `${flag.rollingAverage.toFixed(2)}s`
              : flag.rollingAverage.toFixed(3);
          const curr =
            flag.metric === 'criticalPath'
              ? `${flag.current.toFixed(2)}s`
              : flag.current.toFixed(3);
          console.log(
            chalk.red(`REGRESSION ${label}: ${avg} --> ${curr} (+${pct}%)`),
          );
        }
      }
      console.log();
    },
  )
  .command(
    'benchmark',
    'Run benchmark report (sequential -> parallel -> delta)',
    (y) =>
      y
        .option('junit', {
          type: 'string',
          demandOption: true,
          describe: 'Path to JUnit XML file or directory',
        })
        .option('jobs', {
          type: 'number',
          default: os.cpus().length,
          describe: 'Number of parallel jobs',
        }),
    (argv) => {
      const junitPath = path.resolve(argv.junit as string);
      const jobCount = normalizeJobs(argv.jobs);

      assertJUnitPathExists(junitPath);

      const benchEngine = new TestSplitEngine();
      const benchStart = performance.now();
      const { profile, distribution } = benchEngine.run(
        junitPath,
        jobCount,
        false,
      );
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
      const timeSavedPct =
        sequential === 0 ? 0 : (timeSaved / sequential) * 100;

      const BENCH_SEP = '-'.repeat(SECTION_WIDTH);
      const DELTA_ARROW = '->';

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
      console.log(
        `  Time saved: ${timeSaved.toFixed(2)}s  (${timeSavedPct.toFixed(1)}%)`,
      );
      console.log(`Speedup: ${speedup.toFixed(2)}×`);
      console.log(
        `Balance ratio: ${distribution.metrics.balanceRatio.toFixed(3)}`,
      );
      console.log(BENCH_SEP);
      console.log(`Analysis time: ${benchMs}ms`);
      console.log();
    },
  )
  .command(
    'validate',
    'Validate a generated CI configuration file',
    (y) =>
      y
        .option('file', {
          type: 'string',
          demandOption: true,
          describe: 'Path to the CI configuration file to validate',
        })
        .option('platform', {
          type: 'string',
          choices: ['github', 'gitlab'],
          default: 'github',
          describe: 'Target CI platform',
        }),
    (argv) => {
      const filePath = path.resolve(argv.file as string);
      const platform = argv.platform as Platform;

      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`Error: file does not exist: ${filePath}`));
        process.exit(EXIT_FAILURE);
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      let parsed: any;

      try {
        parsed = YAML.parse(raw);
      } catch (err) {
        console.error(chalk.red('Invalid YAML syntax'));
        if (err instanceof Error) console.error(chalk.red(err.message));
        process.exit(EXIT_FAILURE);
      }

      const issues: string[] = [];

      if (platform === 'github') {
        if (!parsed.on) issues.push('Missing required field: on (trigger)');
        if (!parsed.jobs || Object.keys(parsed.jobs).length === 0)
          issues.push('Missing required field: jobs');
        for (const [name, job] of Object.entries<any>(parsed.jobs ?? {})) {
          if (!job.steps || job.steps.length === 0)
            issues.push(`Job "${name}": missing steps`);
        }
      }

      if (platform === 'gitlab') {
        if (!parsed.stages || parsed.stages.length === 0)
          issues.push('Missing required field: stages');
        const jobEntries = Object.entries<any>(parsed).filter(
          ([k]) => k !== 'stages',
        );
        if (jobEntries.length === 0) issues.push('No jobs defined');
        for (const [name, job] of jobEntries) {
          if (!job.script || job.script.length === 0)
            issues.push(`Job "${name}": missing script`);
        }
      }

      if (issues.length > 0) {
        console.error(
          chalk.red(
            `Validation failed (${issues.length} issue${issues.length > 1 ? 's' : ''})`,
          ),
        );
        issues.forEach((issue) => console.error(chalk.red(`  - ${issue}`)));
        process.exit(EXIT_FAILURE);
      }

          console.log(chalk.green(`${filePath} is a valid ${platform === 'github' ? 'GitHub Actions' : 'GitLab CI'} configuration.`));
        },
      )
  .command(
    'dashboard',
    'Start API + frontend dashboard and open it in your browser',
    (y) =>
      y.option('url', {
        type: 'string',
        default: 'http://localhost:5173',
        describe: 'Dashboard URL to open in browser',
      }),
    (argv) => {
      const dashboardUrl = argv.url as string;
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

      console.log(`Dashboard: ${dashboardUrl}`);

      openInBrowser(dashboardUrl);

      const dashboardProcess = spawn(npmCmd, ['run', 'dashboard'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      });

      dashboardProcess.on('error', (err) => {
        console.error(chalk.red(`Failed to start dashboard: ${(err as Error).message}`));
        process.exit(EXIT_FAILURE);
      });

      dashboardProcess.on('exit', (code) => {
        process.exit(code ?? 0);
      });
    },
  )
  .command(
    'run',
    'Schedule and execute test subsets in parallel, recording real wall-clock time per job',
    (y) =>
      y
        .option('junit', {
          type: 'string',
          demandOption: true,
          describe: 'Path to JUnit XML test report',
        })
        .option('jobs', {
          type: 'number',
          demandOption: true,
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
          describe: 'Enable dynamic work queue: workers pull the next test when idle instead of going idle',
        })
        .option('steal', {
          type: 'boolean',
          default: false,
          describe: 'Enable work stealing: idle workers steal the largest task from the busiest peer',
        })
        .option('affinity', {
          type: 'boolean',
          default: false,
          describe: 'Pin each worker to a distinct least-loaded CPU core (Linux: taskset, other platforms: no-op)',
        }),
    async (argv) => {
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
      const { distribution } = engine.run(junitPath, jobCount, true, algorithm, riskFactor);

      console.log(chalk.bold(`\nSpawning ${distribution.jobs.length} job(s) using ${algorithm.toUpperCase()}...\n`));

      const activeCount = distribution.jobs.filter((j) => j.tasks.length > 0).length;
      const coreIds = affinity ? await (await import('../runner/CoreAffinity')).getLeastLoadedCores(activeCount) : undefined;
      if (affinity && coreIds) {
        console.log(chalk.dim(`Core affinity: pinning workers to cores [${coreIds.join(', ')}]`));
      }

      const results = await (steal
        ? runAllJobsWorkStealing(distribution.jobs, cmd, filterFlag)
        : dynamic
          ? runAllJobsDynamic(distribution.jobs, cmd, filterFlag)
          : runAllJobs(distribution.jobs, cmd, filterFlag, filterJoin, coreIds));

      let allPassed = true;
      for (const r of results) {
        const status = r.exitCode === 0 ? chalk.green('PASS') : chalk.red('FAIL');
        console.log(`Job ${r.jobId}  ${status}  ${r.wallClockMs.toFixed(0)}ms  (${r.testNames.length} tests)`);
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
    },
  )
  .command(
    'generate-dockerfile',
    'Generate a Dockerfile for a Maven/Java project',
    (y) =>
      y
        .option('pom', {
          type: 'string',
          default: 'pom.xml',
          describe: 'Path to pom.xml (used to detect Java version and Maven wrapper)',
        })
        .option('out', {
          type: 'string',
          default: 'Dockerfile',
          describe: 'Output path for the generated Dockerfile',
        }),
    (argv) => {
      const pomPath = path.resolve(argv.pom as string);
      const outPath = path.resolve(argv.out as string);

      let javaVersion: string | undefined;
      const hasMavenWrapper = fs.existsSync(path.resolve('mvnw'));

      if (fs.existsSync(pomPath)) {
        const pomInfo = parsePom(pomPath);
        if (pomInfo.javaVersion) javaVersion = pomInfo.javaVersion;
      }

      const content = generateDockerfile({ javaVersion, hasMavenWrapper });
      fs.writeFileSync(outPath, content, 'utf-8');
      console.log(chalk.green(`Dockerfile written to ${outPath}`));
      if (javaVersion) {
        console.log(chalk.dim(`  Java version: ${javaVersion}`));
      }
      if (hasMavenWrapper) {
        console.log(chalk.dim('  Using ./mvnw'));
      }
    },
  )
  .command(
    'dashboard',
    'Start the TestSplit dashboard (builds frontend if needed, then opens in browser)',
    (y) =>
      y
        .option('port', {
          type: 'number',
          default: 3001,
          describe: 'Port to serve the dashboard on',
        })
        .option('no-open', {
          type: 'boolean',
          default: false,
          describe: 'Start the server without opening a browser tab',
        }),
    async (argv) => {
      const { execSync, spawn } = await import('child_process');
      const distPath = path.resolve('src/frontend/dist/index.html');

      if (!fs.existsSync(distPath)) {
        console.log(chalk.dim('Building frontend...'));
        try {
          execSync('npm run build:frontend', { stdio: 'inherit' });
        } catch {
          console.error(chalk.red('Frontend build failed.'));
          process.exit(EXIT_FAILURE);
        }
      }

      const port = argv.port;
      process.env.PORT = String(port);

      process.on('SIGINT', () => {
        console.log(chalk.dim('\nDashboard stopped.'));
        process.exit(0);
      });

      // Start the API server in-process, already in ts-node
      const { buildApp } = await import('../api/server');
      const app = await buildApp();
      try {
        await app.listen({ port, host: '0.0.0.0' });
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.error(chalk.red(`Port ${port} is already in use. Stop the existing server or run with --port <n>.`));
          process.exit(EXIT_FAILURE);
        }
        throw err;
      }

      const url = `http://localhost:${port}`;
      console.log(chalk.green(`Dashboard running at ${url}`));

      if (!argv['no-open']) {
        const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        spawn(opener, [url], { detached: true, stdio: 'ignore' });
      }
    },
  )
  .version(packageJson.version)
  .alias('h', 'help')
  .demandCommand()
  .help()
  .parse();
