import { JobGroup } from './JobGroup';
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

function renderGitHubJob(job: JobGroup, mavenBin: string): string {
  const needsLine =
    job.needs && job.needs.length > 0
      ? `\n    needs: [${job.needs.map((id) => `job-${id}`).join(', ')}]`
      : '';

  return `
  job-${job.id}:
    runs-on: ubuntu-latest${needsLine}
    steps:
      - uses: actions/checkout@v4
      - run: ${mavenBin} test -Dtest=${job.tests.join(',')}`;
}

export function generateGitHubActionsConfig(
  jobs: JobGroup[],
  mavenBin: string = 'mvn',
  resourceConstraints?: CIResourceConstraints,
): string {
  validateJobGroups(jobs, 'GitHub Actions');

  const jobsYaml = jobs.map((job) => renderGitHubJob(job, mavenBin)).join('\n');

  const constraintsComment = resourceConstraints
    ? `# Resource constraints captured during profiling\n# Keep baseline and optimized runs on identical container config\n# cpu_limit: ${resourceConstraints.cpuCores}\n# memory_limit_mb: ${resourceConstraints.memoryLimitMb ?? 'unknown'}\n\n`
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

  const githubServices = services ? buildGitHubServices(services) : undefined;
  const composeStartStep = hasDockerCompose ? buildDockerComposeStartStep() : null;
  const composeStopStep = hasDockerCompose ? buildDockerComposeStopStep() : null;

  const buildJob = JSON.parse(JSON.stringify(baseJob));
  if (containerImage) buildJob.container = containerImage;
  if (githubServices) buildJob.services = githubServices;
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

  const setupSteps = (baseJob.steps as any[]).filter((step: any) => !isMavenStep(step));

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
    if (containerImage) testJob.container = containerImage;
    if (githubServices) testJob.services = githubServices;
    const testSteps: any[] = [...JSON.parse(JSON.stringify(setupSteps))];
    if (composeStartStep) testSteps.push(composeStartStep);
    testSteps.push({ uses: 'actions/download-artifact@v4', with: { name: artifactName } });
    if (coreDetectStep) testSteps.push(coreDetectStep);
    testSteps.push({
      name: 'Run tests',
      run: [
        `${mavenBin} test`,
        `-Dtest=${[...new Set(job.tests.map(toMavenClassName))].join(',')}`,
        `-DfailIfNoTests=false`,
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
