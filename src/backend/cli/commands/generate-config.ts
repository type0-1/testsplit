import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import YAML from 'yaml';
import { TestSplitEngine, Algorithm } from '../../core/TestSplitEngine';
import { runDetection } from '../../core/DetectionOrchestrator';
import {
  findExistingCIFile,
  findTestJobs,
  extractTestCommands,
} from '../CIConfigReader';
import { buildGitHubPhasedJobs } from '../../generator/GitHubActionsGenerator';
import { buildGitLabSplitJobs } from '../../generator/GitLabCIGenerator';
import {
  buildJobsWithDependencies,
  groupSlotsIntoRunners,
} from '../../generator/JobBuilder';
import { normalizeJobs, assertJUnitPathExists } from '../utils/validation';
import { prependSchedulingHeader, validateFinalCIConfig } from '../utils/ci-config';
import { EXIT_FAILURE } from '../constants';

type Platform = 'github' | 'gitlab';

export function buildGenerateConfigCommand(y: Argv): Argv {
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
      describe: 'Path to an existing CI YAML template to inject split jobs into',
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
      describe: 'Multiplier k for stdDev in variance-aware scheduling weight (meanDuration + k*stdDev)',
    })
    .option('artifact-path', {
      type: 'string',
      default: 'target/',
      describe: 'Path to upload as build artifact when using --split-phases (default: target/ for standard Maven)',
    })
    .option('src', {
      type: 'string',
      default: 'src/test/java',
      describe: 'Path to Java test sources for dependency detection (default: src/test/java)',
    });
}

export function handleGenerateConfigCommand(argv: any): void {
  const junitPath = path.resolve(argv.junit as string);
  const runnerCores = argv['runner-cores'] as number;
  const jobCount = normalizeJobs(
    (argv.jobs as number | undefined) ?? os.cpus().length,
  );
  const platform = argv.platform as Platform;
  const algorithm = argv.algorithm as Algorithm;
  const riskFactor = argv['risk-factor'] as number;
  const artifactPath = argv['artifact-path'] as string;
  const outPath = path.resolve(argv.out as string);
  const outDir = path.dirname(outPath);
  const dataDirArg = (argv.data as string | undefined) ?? '.data';
  const dataDir = path.isAbsolute(dataDirArg)
    ? dataDirArg
    : path.resolve(outDir, dataDirArg);
  const mavenBin = (argv['maven-bin'] as string) ?? 'mvn';
  const dryRun = argv['dry-run'] as boolean;

  const templateFlag = argv['template'] as string | undefined;
  const fromFlag = argv['from'] as string | undefined;
  const existingCIPath = templateFlag
    ? path.resolve(templateFlag)
    : fromFlag
      ? path.resolve(fromFlag)
      : findExistingCIFile(platform);

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
    console.error(chalk.red(`Error: output directory does not exist: ${outDir}`));
    process.exit(EXIT_FAILURE);
  }

  if (fs.existsSync(outPath) && fs.statSync(outPath).isDirectory()) {
    console.error(chalk.red('Error: --out must be a file path, not a directory'));
    process.exit(EXIT_FAILURE);
  }

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
    console.log(chalk.dim('  docker-compose.yml detected startup steps will be injected'));
  } else if (lifecycle.requirements.length > 0) {
    const types = lifecycle.requirements.map((r) => r.type).join(', ');
    console.log(chalk.dim(`  Detected services: ${types}`));
  }

  try {
    const engine = new TestSplitEngine(dataDir);
    /*
      When runnerCores > 1 we schedule jobCount*runnerCores virtual slots so LPT can balance at sub-runner granularity, then group them back into
      jobCount runners (NxM -> N).
    */
    const totalSlots = runnerCores > 1 ? jobCount * runnerCores : jobCount;
    const result = engine.run(junitPath, totalSlots, true, algorithm, riskFactor, dependencyMap);
    const nonEmptySlots = result.distribution.jobs.filter((j) => j.tasks.length > 0);

    let jobs;
    if (runnerCores > 1 && nonEmptySlots.length >= totalSlots) {
      jobs = groupSlotsIntoRunners(result.distribution.jobs, runnerCores);
    } else if (runnerCores > 1) {
      // If virtual slots are underfilled, schedule directly at runner granularity
      // so the generated CI preserves requested jobCount.
      const rerun = engine.run(junitPath, jobCount, false, algorithm, riskFactor, dependencyMap);
      jobs = buildJobsWithDependencies(rerun.distribution.jobs.filter((j) => j.tasks.length > 0));
    } else {
      jobs = buildJobsWithDependencies(nonEmptySlots);
    }

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

      const generatedJobs = buildGitHubPhasedJobs(
        baseJob,
        jobs,
        mavenBin,
        'build-artifacts',
        artifactPath,
        runnerCores,
        containerImage,
        lifecycle.requirements.length > 0 ? lifecycle.requirements : undefined,
        lifecycle.hasDockerCompose,
      );
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

      const splitJobs = buildGitLabSplitJobs(
        baseJob,
        jobs,
        testCommand,
        runnerCores,
        containerImage,
        lifecycle.requirements.length > 0 ? lifecycle.requirements : undefined,
        lifecycle.hasDockerCompose,
      );
      for (const jobName of testJobs) {
        delete existingCIConfig[jobName];
      }
      Object.assign(existingCIConfig, splitJobs);
      ciConfig = YAML.stringify(existingCIConfig);
    }

    const outputConfig = prependSchedulingHeader(ciConfig, algorithm, riskFactor);
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
}
