#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { TestSplitEngine } from '../core/TestSplitEngine';
import { generateGitHubActionsConfig } from '../generator/GitHubActionsGenerator';
import { generateGitLabCIConfig } from '../generator/GitLabCIGenerator';
import { Task } from '../algorithm/model/Task';
import { renderBar } from '../utils/Terminal';
import { FileStore } from '../storage/FileStore';
import YAML from 'yaml';
import chalk from 'chalk';

type Platform = 'github' | 'gitlab';

function findExistingCIFile(platform: Platform): string | null {
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

function findTestJobs(config: any, platform: Platform): string[] {
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

function extractTestCommands(
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

function buildGitHubSplitJobs(
  baseJob: any,
  jobs: { id: number; tests: string[] }[],
  testCommand: string,
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
          run: `${testCommand} ${job.tests.join(' ')}`.trim(),
        };
      }
      return step;
    });

    splitJobs[`job-${job.id}`] = clonedJob;
  }

  return splitJobs;
}

function buildGitLabSplitJobs(
  baseJob: any,
  jobs: { id: number; tests: string[] }[],
  testCommand: string,
): Record<string, any> {
  const splitJobs: Record<string, any> = {};

  for (const job of jobs) {
    const clonedJob = JSON.parse(JSON.stringify(baseJob));

    const scriptLines = Array.isArray(clonedJob.script)
      ? clonedJob.script
      : [clonedJob.script];

    clonedJob.script = scriptLines.map((line: string) => {
      if (line.toLowerCase().includes('test')) {
        return `${testCommand} ${job.tests.join(' ')}`.trim();
      }
      return line;
    });

    splitJobs[`job-${job.id}`] = clonedJob;
  }

  return splitJobs;
}

function resolveJUnitPath(input: unknown): string {
  return path.resolve(input as string);
}

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

yargs(hideBin(process.argv))
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
          default: 2,
          describe: 'Number of parallel jobs',
        })
        .option('explain', {
          type: 'boolean',
          default: false,
          describe: 'Explain profiling results in plain English',
        }),
    (argv) => {
      const junitPath = path.resolve(argv.junit as string);
      const jobCount = argv.jobs as number;
      const explain = argv.explain as boolean;

      if (!Number.isInteger(jobCount) || jobCount <= 0) {
        console.error(chalk.red('✖ Error: --jobs must be a positive integer'));
        process.exit(EXIT_FAILURE);
      }

      if (!fs.existsSync(junitPath)) {
        console.error(
          chalk.red(`✖ Error: JUnit path does not exist: ${junitPath}`),
        );
        process.exit(EXIT_FAILURE);
      }

      const engine = new TestSplitEngine();
      const { profile, distribution } = engine.run(junitPath, jobCount, true);

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
      } catch (err) {
        // Persistence failures should never break profiling
        console.warn(
          chalk.yellow('⚠ Warning: failed to persist historical deltas'),
        );
      }

      if (profile.testCount === 0) {
        console.error(
          chalk.red('✖ Error: no test cases were parsed from the JUnit input'),
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
      console.log(`Tests parsed:       ${profile.testCount}`);
      console.log(`Total duration:     ${profile.totalDuration.toFixed(2)}s`);
      console.log(`Parallel jobs:      ${distribution.jobCount}\n`);

      console.log('Scheduling metrics');
      console.log('------------------');
      console.log(`Critical path:      ${m.criticalPath.toFixed(2)}s`);
      console.log(`Predicted speed-up: ${predictedSpeedUp.toFixed(2)}×`);
      console.log(`Balance ratio:      ${m.balanceRatio.toFixed(2)}\n`);

      console.log('Job distribution');
      console.log('----------------');

      const maxJobTime = Math.max(...distribution.jobs.map((j) => j.totalTime));

      distribution.jobs.forEach((job, i) => {
        const bar = renderBar(job.totalTime, maxJobTime);
        console.log(
          `  Job ${i + 1}: ${job.totalTime.toFixed(2)}s ${bar} (${job.tasks.length} tests)`,
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

      console.log(chalk.green('✔ Profile completed successfully.'));
    },
  )
  .command(
    'generate-config',
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
          default: 2,
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
        .option('maven-bin', {
          type: 'string',
          default: 'mvn',
          describe: 'Maven executable to run tests (e.g., mvn or ./mvnw)',
        })
        .option('dry-run', {
          type: 'boolean',
          default: false,
          describe: 'Print CI config without writing files',
        }),
    (argv) => {
      const junitPath = resolveJUnitPath(argv.junit);
      const jobCount = argv.jobs as number;
      const platform = argv.platform as Platform;
      const outPath = path.resolve(argv.out as string);
      const outDir = path.dirname(outPath);
      const mavenBin = argv['maven-bin'] as string;
      const dryRun = argv['dry-run'] as boolean;
      const existingCIPath = findExistingCIFile(platform);

      let existingCIConfig: any = null;

      if (existingCIPath) {
        const raw = fs.readFileSync(existingCIPath, 'utf-8');
        existingCIConfig = YAML.parse(raw);
      }

      const testJobs = findTestJobs(existingCIConfig, platform);

      if (!fs.existsSync(outDir)) {
        console.error(
          chalk.red(`✖ Error: output directory does not exist: ${outDir}`),
        );
        process.exit(EXIT_FAILURE);
      }

      if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
        console.error(
          chalk.red('✖ Error: --out must be a file path, not a directory'),
        );
        process.exit(EXIT_FAILURE);
      }

      // Argument validation
      if (!fs.existsSync(junitPath)) {
        console.error(
          chalk.red(`✖ Error: JUnit path does not exist: ${junitPath}`),
        );
        process.exit(EXIT_FAILURE);
      }

      if (!Number.isInteger(jobCount) || jobCount <= 0) {
        console.error(chalk.red('✖ Error: --jobs must be a positive integer'));
        process.exit(EXIT_FAILURE);
      }

      // Main logic with error handling
      try {
        const engine = new TestSplitEngine();
        const result = engine.run(junitPath, jobCount, false);

        const jobs = result.distribution.jobs.map((job, index) => ({
          id: index + 1,
          tests: job.tasks.map((t: Task) => t.id),
        }));

        let ciConfig: string;

        if (platform === 'github' && existingCIConfig) {
          const testJobs = findTestJobs(existingCIConfig, platform);
          if (testJobs.length === 0) {
            throw new Error(
              'No test job found in existing GitHub Actions workflow',
            );
          }

          const testCommands = extractTestCommands(
            existingCIConfig,
            platform,
            testJobs,
          );

          const baseJobName = testJobs[0];
          const baseJob = existingCIConfig.jobs[baseJobName];
          const testCommand = testCommands[0];

          const splitJobs = buildGitHubSplitJobs(baseJob, jobs, testCommand);

          // Remove original test job
          delete existingCIConfig.jobs[baseJobName];

          // Inject split jobs
          existingCIConfig.jobs = {
            ...existingCIConfig.jobs,
            ...splitJobs,
          };

          ciConfig = YAML.stringify(existingCIConfig);
        } else if (platform === 'gitlab' && existingCIConfig) {
          const testJobs = findTestJobs(existingCIConfig, platform);
          if (testJobs.length === 0) {
            throw new Error('No test job found in existing GitLab CI config');
          }

          const testCommands = extractTestCommands(
            existingCIConfig,
            platform,
            testJobs,
          );

          const baseJobName = testJobs[0];
          const baseJob = existingCIConfig[baseJobName];
          const testCommand = testCommands[0];

          const splitJobs = buildGitLabSplitJobs(baseJob, jobs, testCommand);

          // Remove original test job
          delete existingCIConfig[baseJobName];

          // Inject split jobs
          Object.assign(existingCIConfig, splitJobs);

          ciConfig = YAML.stringify(existingCIConfig);
        } else {
          // Fallback: no existing CI file
          ciConfig =
            platform === 'github'
              ? generateGitHubActionsConfig(jobs, mavenBin)
              : generateGitLabCIConfig(jobs, mavenBin);
        }

        if (dryRun) {
          process.stdout.write(ciConfig);
        } else {
          fs.writeFileSync(outPath, ciConfig, 'utf-8');
          console.log(`CI configuration written to ${outPath}`);
        }
      } catch (err: unknown) {
        console.error(
          chalk.red('✖ Error: failed to generate CI configuration'),
        );

        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        } else {
          console.error(chalk.red(String(err)));
        }

        process.exit(EXIT_FAILURE);
      }
    },
  )

  .demandCommand()
  .help()
  .parse();
