import { JobGroup } from './JobGroup';
import chalk from 'chalk';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';
import { ServiceRequirement } from '../detector/LifecycleDetector';
import { buildGitHubServices, buildDockerComposeStartStep, buildDockerComposeStopStep } from './LifecycleStepGenerator';


export interface CIResourceConstraints {
  cpuCores: number;
  memoryLimitMb: number | null;
}

type JobCommandBuilder = (tests: string[]) => string;

function resolveJobCommandBuilder(mavenBinOrBuilder: string | JobCommandBuilder): JobCommandBuilder {
  if (typeof mavenBinOrBuilder === 'function') {
    return mavenBinOrBuilder;
  }

  return (tests: string[]) => `${mavenBinOrBuilder} test -Dtest=${tests.join(',')}`;
}

function renderGitHubJob(job: JobGroup, buildJobCommand: JobCommandBuilder): string {
  const needsLine = job.needs && job.needs.length > 0 ? `\n    needs: [${job.needs.map((id) => `job-${id}`).join(', ')}]` : '';

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

  const isMavenStep = (step: any): boolean => typeof step.run === 'string' && /^(mvn|\.\/mvnw)\b/.test(step.run.trim());

  const githubServices = services ? buildGitHubServices(services) : undefined;
  const composeStartStep = hasDockerCompose ? buildDockerComposeStartStep() : null;
  const composeStopStep = hasDockerCompose ? buildDockerComposeStopStep() : null;

  /**
   * Strip matrix from build job. Phased pipelines require a single build artifact. 
   * A matrix would produce N concurrent uploads with the same name, so resolve matrix.java references in steps using the last (highest) java value.
   */
  
  const buildJob = JSON.parse(JSON.stringify(baseJob));
  const matrixDef: Record<string, (string | number)[]> = baseJob.strategy?.matrix ?? {};
  const javaMatrix: (string | number)[] | undefined = matrixDef['java'];
  if (javaMatrix) matrixDef['java'] = [javaMatrix[javaMatrix.length - 1]];

  const resolveMatrixRefs = (json: string): string =>
      json.replace(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/g, (_match, key) => {
      const vals = matrixDef[key];
      return vals && vals.length > 0 ? String(vals[0]) : '';
    });

  delete buildJob.strategy;
  delete buildJob.name;
  buildJob['runs-on'] = 'ubuntu-latest';

  /**
   * Strip env entries whose values reference matrix variables and build a substitution map
   * so that shell references like $ROOT_POM in step run commands can be inlined.
   */

  const strippedEnvSubstitutions: Record<string, string> = {};
  if (buildJob.env) {
    for (const [k, v] of Object.entries(buildJob.env)) {
      if (typeof v === 'string' && v.includes('matrix.')) {
        strippedEnvSubstitutions[k] = resolveMatrixRefs(v);
        delete buildJob.env[k];
      }
    }
    if (Object.keys(buildJob.env).length === 0) delete buildJob.env;
  }

  const resolveStrippedEnvRefs = (json: string): string => {
    let result = json;
    for (const [k, v] of Object.entries(strippedEnvSubstitutions)) {
      result = result.replace(new RegExp(`\\$${k}\\b`, 'g'), v);
    }
    return result;
  };

  if (containerImage) buildJob.container = containerImage;
  if (githubServices) buildJob.services = githubServices;

  buildJob.steps = buildJob.steps.map((step: any) => {
    const resolved = JSON.parse(resolveStrippedEnvRefs(resolveMatrixRefs(JSON.stringify(step))));
    if (isMavenStep(resolved) && !resolved.run.includes('-DskipTests')) {
      return { ...resolved, run: `${resolved.run.trim()} -DskipTests -Drat.skip=true` };
    }
    return resolved;
  });

  buildJob.steps.push({
    uses: 'actions/upload-artifact@v4',
    with: { name: artifactName, path: artifactPath },
  });

  result['build'] = buildJob;

  const setupSteps = (baseJob.steps as any[])
    .filter((step: any) => !isMavenStep(step))
    .map((step: any) => JSON.parse(resolveStrippedEnvRefs(resolveMatrixRefs(JSON.stringify(step)))));

  const coreDetectStep = runnerCores > 1 ? {
    name: 'Detect available cores',
    id: 'cores',
    run: [
      'TOTAL=$(nproc)',
      "LOAD=$(awk '{print int($1+0.5)}' /proc/loadavg)",
      'IDLE=$(( TOTAL - LOAD > 1 ? TOTAL - LOAD : 1 ))',
      'echo "count=$IDLE" >> $GITHUB_OUTPUT',
    ].join('\n')
  } : null;

  const forkFlags = runnerCores > 1 ? ['-Dsurefire.forkCount=${{ steps.cores.outputs.count }}', '-Dsurefire.reuseForks=true'] : [];

  for (const job of jobs) {
    const testJob: any = JSON.parse(JSON.stringify(baseJob));
    delete testJob.strategy;
    delete testJob.name;
    testJob['runs-on'] = 'ubuntu-latest';

    if (testJob.env) {
      for (const [k, v] of Object.entries(testJob.env)) {
        if (typeof v === 'string' && v.includes('matrix.')) delete testJob.env[k];
      }
      if (Object.keys(testJob.env).length === 0) delete testJob.env;
    }

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
        `-Dtest=${[...new Set(job.tests)].join(',')}`,
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
