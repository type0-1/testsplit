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
import { generateGitHubActionsConfig } from '../generator/GitHubActionsGenerator';
import { generateGitLabCIConfig } from '../generator/GitLabCIGenerator';
import { inspectProjectTestCommandFormat } from '../generator/ProjectInspection';
import { getSchemaValidator } from '../generator/getSchemaValidator';
import { validateYamlSyntax } from '../generator/YAMLSyntaxValidator';
import { Task } from '../algorithm/model/Task';
import { JobDistribution } from '../algorithm/model/JobDistribution';
import { renderBar } from '../utils/Terminal';
import { FileStore } from '../storage/FileStore';
import { HistoricalProfiler } from '../profiler/core/HistoricalProfiler';
import { ProfileMetadata } from '../profiler/model/Profile';
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

export function findExistingCIFile(platform: Platform): string | null {
  if (platform === 'github') {
    const workflowsDir = path.resolve('.github/workflows');
    if (!fs.existsSync(workflowsDir)) {
      return null;
    }

    const files = fs
      .readdirSync(workflowsDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

    return files.length > 0 ? path.join(workflowsDir, files[0]) : null;
  }

  if (platform === 'gitlab') {
    const gitlabPath = path.resolve('.gitlab-ci.yml');
    return fs.existsSync(gitlabPath) ? gitlabPath : null;
  }

  return null;
}

export function findTestJobs(config: any, platform: Platform): string[] {
  const testJobs: string[] = [];
  if (!config) return testJobs;

  if (platform === 'github') {
    const jobs = config.jobs ?? {};
    for (const [jobName, job] of Object.entries<any>(jobs)) {
      const steps = job.steps ?? [];
      for (const step of steps) {
        if (
          typeof step.run === 'string' &&
          step.run.toLowerCase().includes('test')
        ) {
          testJobs.push(jobName);
          break;
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const [jobName, job] of Object.entries<any>(config)) {
      const script = job?.script;
      if (!script) continue;

      const lines = Array.isArray(script) ? script : [script];
      if (lines.some((l) => l.toLowerCase().includes('test'))) {
        testJobs.push(jobName);
      }
    }
  }

  return testJobs;
}

export function extractTestCommands(
  config: any,
  platform: Platform,
  testJobs: string[],
): string[] {
  const commands: string[] = [];
  if (!config) return commands;

  if (platform === 'github') {
    for (const jobName of testJobs) {
      const job = config.jobs?.[jobName];
      const steps = job?.steps ?? [];

      for (const step of steps) {
        if (
          typeof step.run === 'string' &&
          step.run.toLowerCase().includes('test')
        ) {
          commands.push(step.run.trim());
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const jobName of testJobs) {
      const job = config[jobName];
      const script = job?.script;
      if (!script) continue;

      const lines = Array.isArray(script) ? script : [script];
      for (const line of lines) {
        if (line.toLowerCase().includes('test')) {
          commands.push(line.trim());
        }
      }
    }
  }

  return commands;
}

export function buildGitHubSplitJobs(
  baseJob: any,
  jobs: { id: number; tests: string[]; needs?: number[] }[],
  buildJobCommand: (tests: string[]) => string,
): Record<string, any> {
  const splitJobs: Record<string, any> = {};

  for (const job of jobs) {
    const clonedJob = JSON.parse(JSON.stringify(baseJob));

    clonedJob.steps = clonedJob.steps.map((step: any) => {
      if (
        typeof step.run === 'string' &&
        step.run.toLowerCase().includes('test')
      ) {
        return {
          ...step,
          run: buildJobCommand(job.tests),
        };
      }
      return step;
    });

    delete clonedJob.needs;
    if (job.needs && job.needs.length > 0) {
      clonedJob.needs = job.needs.map((id) => `job-${id}`);
    }

    splitJobs[`job-${job.id}`] = clonedJob;
  }

  return splitJobs;
}

export function buildGitLabSplitJobs(
  baseJob: any,
  jobs: { id: number; tests: string[]; needs?: number[] }[],
  buildJobCommand: (tests: string[]) => string,
): Record<string, any> {
  const splitJobs: Record<string, any> = {};

  for (const job of jobs) {
    const clonedJob = JSON.parse(JSON.stringify(baseJob));

    const scriptLines = Array.isArray(clonedJob.script)
      ? clonedJob.script
      : [clonedJob.script];

    clonedJob.script = scriptLines.map((line: string) => {
      if (line.toLowerCase().includes('test')) {
        return buildJobCommand(job.tests);
      }
      return line;
    });

    splitJobs[`job-${job.id}`] = clonedJob;
  }

  return splitJobs;
}

function buildJobsWithDependencies(distributionJobs: { tasks: Task[] }[]): { id: number; tests: string[]; needs?: number[] }[] {
  const taskToJobId = new Map<string, number>();

  distributionJobs.forEach((job, index) => {
    const jobId = index + 1;
    for (const task of job.tasks) {
      taskToJobId.set(task.id, jobId);
    }
  });

  return distributionJobs.map((job, index) => {
    const jobId = index + 1;
    const needs = new Set<number>();

    for (const task of job.tasks) {
      for (const dependencyId of task.dependencies ?? []) {
        const dependencyJobId = taskToJobId.get(dependencyId);
        if (dependencyJobId !== undefined && dependencyJobId !== jobId) {
          needs.add(dependencyJobId);
        }
      }
    }

    const sortedNeeds = [...needs].sort((a, b) => a - b);

    return {
      id: jobId,
      tests: job.tasks.map((t) => t.id),
      ...(sortedNeeds.length > 0 ? { needs: sortedNeeds } : {}),
    };
  });
}

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

function isJobDistribution(value: unknown): value is JobDistribution {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<JobDistribution>;
  return Array.isArray(candidate.jobs);
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
        console.log(`  ${interpretation}\n`);
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
          default: os.cpus().length,
          describe: 'Number of parallel jobs',
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
        }),
    (argv) => {
      const junitPath = resolveJUnitPath(argv.junit);
      const jobCount = normalizeJobs(argv.jobs);
      const platform = argv.platform as Platform;
      const algorithm = (argv.algorithm as Algorithm | undefined) ?? 'lpt';
      const riskFactor = normalizeRiskFactor(
        (argv['risk-factor'] as number | undefined) ?? 1.0,
      );
      const outPath = path.resolve(argv.out as string);
      const outDir = path.dirname(outPath);
      const templatePathArg = argv.template as string | undefined;
      const dataDir = argv.data as string;
      const mavenBin = (argv['maven-bin'] as string) ?? 'mvn';
      const dryRun = argv['dry-run'] as boolean;
      const detectedFormat = inspectProjectTestCommandFormat({
        projectRoot: process.cwd(),
        mavenBin,
      });
      const existingCIPath = findExistingCIFile(platform);
      const shouldInjectIntoExistingCI =
        !!existingCIPath && path.resolve(existingCIPath) === outPath;
      const templatePath = templatePathArg
        ? path.resolve(templatePathArg)
        : shouldInjectIntoExistingCI
          ? path.resolve(existingCIPath as string)
          : null;

      let existingCIConfig: any = null;

      if (templatePath) {
        if (!fs.existsSync(templatePath)) {
          console.error(
            chalk.red(`Error: template file does not exist: ${templatePath}`),
          );
          process.exit(EXIT_FAILURE);
        }

        const raw = fs.readFileSync(templatePath, 'utf-8');
        existingCIConfig = YAML.parse(raw);
      }

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

      // Main logic with error handling
      try {
        const store = new FileStore(dataDir);
        let distribution: JobDistribution | null = null;
        let profileMetadata: ProfileMetadata | undefined;

        const persistedDistribution = store.loadLatestDistribution();

        if (isJobDistribution(persistedDistribution)) {
          distribution = persistedDistribution;

          const profiles = store.loadProfiles();
          const latestProfile = profiles[profiles.length - 1];
          profileMetadata = latestProfile?.metadata;
        } else {
          console.log(
            chalk.yellow(
              `No saved distribution found in ${path.resolve(dataDir)}. Running profile as a prerequisite...`,
            ),
          );

          const engine = new TestSplitEngine(dataDir);
          const result = engine.run(
            junitPath,
            jobCount,
            true,
            algorithm,
            riskFactor,
          );

          distribution = result.distribution;
          profileMetadata = result.profile.metadata;

          console.log(
            chalk.green(
              `Saved prerequisite distribution to ${path.resolve(dataDir, 'distributions')}`,
            ),
          );
        }

        if (!distribution) {
          throw new Error('No distribution available for CI generation');
        }

        const jobs = buildJobsWithDependencies(distribution.jobs);

        const metadata = profileMetadata;
        const resourceConstraints = metadata
          ? {
              cpuCores: metadata.cpuCores,
              memoryLimitMb: metadata.memoryLimitMb ?? null,
            }
          : undefined;

        let ciConfig: string;

        if (existingCIConfig) {
          const testJobs = findTestJobs(existingCIConfig, platform);
          if (testJobs.length === 0) {
            throw new Error('No test jobs found in existing CI config');
          }

          const commands = extractTestCommands(existingCIConfig, platform, testJobs);
          const buildJobCommand =
            commands.length > 0
              ? (tests: string[]) => `${commands[0]} ${tests.join(' ')}`.trim()
              : detectedFormat.buildCommand;

          if (platform === 'github') {
            const baseJobName = testJobs[0];
            const baseJob = existingCIConfig.jobs?.[baseJobName];
            if (!baseJob) {
              throw new Error('Unable to locate base GitHub test job');
            }

            const splitJobs = buildGitHubSplitJobs(baseJob, jobs, buildJobCommand);
            for (const jobName of testJobs) {
              delete existingCIConfig.jobs?.[jobName];
            }
            existingCIConfig.jobs = {
              ...(existingCIConfig.jobs ?? {}),
              ...splitJobs,
            };
            ciConfig = YAML.stringify(existingCIConfig);
          } else {
            const baseJobName = testJobs[0];
            const baseJob = existingCIConfig[baseJobName];
            if (!baseJob) {
              throw new Error('Unable to locate base GitLab test job');
            }

            const splitJobs = buildGitLabSplitJobs(baseJob, jobs, buildJobCommand);
            for (const jobName of testJobs) {
              delete existingCIConfig[jobName];
            }
            Object.assign(existingCIConfig, splitJobs);
            ciConfig = YAML.stringify(existingCIConfig);
          }
        } else if (platform === 'github') {
          if (resourceConstraints) {
            ciConfig = generateGitHubActionsConfig(
              jobs,
              detectedFormat.buildCommand,
              resourceConstraints,
            );
          } else {
            ciConfig = generateGitHubActionsConfig(jobs, detectedFormat.buildCommand);
          }
        } else if (resourceConstraints) {
          ciConfig = generateGitLabCIConfig(
            jobs,
            detectedFormat.buildCommand,
            resourceConstraints,
          );
        } else {
          ciConfig = generateGitLabCIConfig(jobs, detectedFormat.buildCommand);
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
        console.error(chalk.red('Error: failed to generate CI configuration'));

        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        } else {
          console.error(chalk.red(String(err)));
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
  .version(packageJson.version)
  .alias('h', 'help')
  .demandCommand()
  .help()
  .parse();
