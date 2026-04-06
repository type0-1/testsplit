import { JobGroup } from './JobGroup';
import chalk from 'chalk';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';
import { ServiceRequirement } from '../detector/LifecycleDetector';
import { buildGitHubServices, buildDockerComposeStartStep, buildDockerComposeStopStep } from './LifecycleStepGenerator';
import { toMavenClassName } from './JobBuilder';

export interface CIResourceConstraints {
  cpuCores: number;
  memoryLimitMb: number | null;
}

type JobCommandBuilder = (tests: string[]) => string;

function resolveJobCommandBuilder(
  mavenBinOrBuilder: string | JobCommandBuilder,
): JobCommandBuilder {
  if (typeof mavenBinOrBuilder === 'function') {
    return mavenBinOrBuilder;
  }

  return (tests: string[]) => `${mavenBinOrBuilder} test -Dtest=${tests.join(',')}`;
}

function renderGitHubJob(job: JobGroup, buildJobCommand: JobCommandBuilder): string {
  const needsLine =
    job.needs && job.needs.length > 0
      ? `\n    needs: [${job.needs.map((id) => `job-${id}`).join(', ')}]`
      : '';

  return `
  job-${job.id}:
    runs-on: ubuntu-latest${needsLine}
    steps:
      - uses: actions/checkout@v4
      - run: ${buildJobCommand(job.tests)}`;
}

export function generateGitHubActionsConfig(
  jobs: JobGroup[],
  mavenBinOrBuilder: string | JobCommandBuilder = 'mvn',
  resourceConstraints?: CIResourceConstraints,
): string {
  validateJobGroups(jobs, 'GitHub Actions');

  const buildJobCommand = resolveJobCommandBuilder(mavenBinOrBuilder);
  const jobsYaml = jobs.map((job) => renderGitHubJob(job, buildJobCommand)).join('\n');

  const constraintsComment = resourceConstraints
    ? `# Resource constraints captured during profiling\n# Keep baseline and optimized runs on identical container config\n# cpu_limit: ${resourceConstraints.cpuCores}\n# memory_limit_mb: ${resourceConstraints.memoryLimitMb ?? chalk.yellow('unknown')}\n\n`
    : '';

  const yamlOutput = `${constraintsComment}name: TestSplit CI

on: [push, pull_request]

jobs:${jobsYaml}
`;

  validateYamlSyntax(yamlOutput);

  const validator = getSchemaValidator('github');
  validator?.validate(yamlOutput);

  return yamlOutput;
}

function substituteMatrixVars(obj: unknown, matrix: Record<string, string>): unknown {
  if (typeof obj === 'string') {
    let result = obj;
    for (const [key, value] of Object.entries(matrix)) {
      result = result.replace(new RegExp(`\\$\\{\\{\\s*matrix\\.${key}\\s*\\}\\}`, 'g'), value);
    }
    // Replace remaining complex expressions containing matrix refs (e.g. OS ternaries)
    result = result.replace(/\$\{\{[^}]*matrix\.[^}]*\}\}/g, 'temurin');
    return result;
  }
  if (Array.isArray(obj)) return obj.map((item) => substituteMatrixVars(item, matrix));
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = substituteMatrixVars(v, matrix);
    return out;
  }
  return obj;
}

export function buildGitHubPhasedJobs(
  baseJob: any,
  jobs: { id: number; tests: string[]; needs?: number[] }[],
  mavenBin: string,
  artifactName: string = 'build-artifacts',
  artifactPath: string = 'target/',
  runnerCores: number = 1,
  containerImage?: string,
  services?: ServiceRequirement[],
  hasDockerCompose?: boolean,
): Record<string, any> {
  const result: Record<string, any> = {};

  const isMavenStep = (step: any): boolean =>
    typeof step.run === 'string' && /^(mvn|\.\/mvnw)\b/.test(step.run.trim());

  // Extract matrix values before deleting the strategy, so we can substitute them in copied steps
  const matrixValues: Record<string, string> = {};
  if (baseJob.strategy?.matrix) {
    for (const [key, values] of Object.entries(baseJob.strategy.matrix as Record<string, unknown>)) {
      if (Array.isArray(values) && values.length > 0) {
        matrixValues[key] = String(values[0]);
      }
    }
  }

  const githubServices = services ? buildGitHubServices(services) : undefined;
  const composeStartStep = hasDockerCompose ? buildDockerComposeStartStep() : null;
  const composeStopStep = hasDockerCompose ? buildDockerComposeStopStep() : null;

  const buildJob = JSON.parse(JSON.stringify(baseJob));
  buildJob.name = 'Build';
  buildJob['runs-on'] = 'ubuntu-latest';
  delete buildJob.strategy;
  delete buildJob['continue-on-error'];
  delete buildJob.container;
  if (containerImage) buildJob.container = containerImage;
  if (githubServices) buildJob.services = githubServices;
  buildJob.steps = substituteMatrixVars(buildJob.steps, matrixValues) as any[];
  buildJob.steps = buildJob.steps.map((step: any) => {
    if (isMavenStep(step) && !step.run.includes('-DskipTests')) {
      return { ...step, run: `${step.run.trim()} -DskipTests` };
    }
    return step;
  });
  buildJob.steps.push({
    uses: 'actions/upload-artifact@v4',
    with: { name: artifactName, path: artifactPath },
  });
  result['build'] = buildJob;

  const setupSteps = (substituteMatrixVars(
    (baseJob.steps as any[]).filter((step: any) => !isMavenStep(step)),
    matrixValues,
  ) as any[]);

  const coreDetectStep = runnerCores > 1 ? {
    name: 'Detect available cores',
    id: 'cores',
    run: [
      'TOTAL=$(nproc)',
      "LOAD=$(awk '{print int($1+0.5)}' /proc/loadavg)",
      'IDLE=$(( TOTAL - LOAD > 1 ? TOTAL - LOAD : 1 ))',
      'echo "count=$IDLE" >> $GITHUB_OUTPUT',
    ].join('\n'),
  } : null;

  const forkFlags = runnerCores > 1
    ? ['-Dsurefire.forkCount=${{ steps.cores.outputs.count }}', '-Dsurefire.reuseForks=true']
    : [];

  for (const job of jobs) {
    const testJob: any = JSON.parse(JSON.stringify(baseJob));
    testJob.name = `Run Tests (Job ${job.id})`;
    testJob['runs-on'] = 'ubuntu-latest';
    delete testJob.strategy;
    delete testJob['continue-on-error'];
    delete testJob.container;
    if (containerImage) testJob.container = containerImage;
    if (githubServices) testJob.services = githubServices;
    const testSteps: any[] = [...JSON.parse(JSON.stringify(setupSteps))];
    if (composeStartStep) testSteps.push(composeStartStep);
    testSteps.push({ uses: 'actions/download-artifact@v4', with: { name: artifactName, path: artifactPath } });
    if (coreDetectStep) testSteps.push(coreDetectStep);
    testSteps.push({
      name: 'Run tests',
      run: [
        `${mavenBin} test`,
        `-Dtest=${[...new Set(job.tests.map(toMavenClassName))].join(',')}`,
        `-DfailIfNoTests=false`,
        `-Drat.skip=true`,
        ...forkFlags,
      ].join(' '),
    });
    if (composeStopStep) testSteps.push(composeStopStep);
    testJob.steps = testSteps;
    testJob.needs = ['build'];
    result[`test-job-${job.id}`] = testJob;
  }

  return result;
}
