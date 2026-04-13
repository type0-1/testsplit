import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import type { CIResourceConstraints } from './GitHubActionsGenerator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';
import { ServiceRequirement } from '../detector/LifecycleDetector';
import { buildGitLabServices, buildDockerComposeBeforeScript } from './LifecycleStepGenerator';
import { JobCommandBuilder, resolveJobCommandBuilder } from './JobCommandBuilder';
import { isMavenCommand, isMavenTestCommand } from './MavenCommand';

type JsonObject = Record<string, unknown>;

function renderGitLabJob(job: JobGroup, buildJobCommand: JobCommandBuilder): string {
  return `
job-${job.id}:
  stage: test
  script:
    - ${buildJobCommand(job.tests)}`;
}

export function generateGitLabCIConfig(
  jobs: JobGroup[],
  mavenBinOrBuilder: string | JobCommandBuilder = 'mvn',
  resourceConstraints?: CIResourceConstraints,
): string {
  validateJobGroups(jobs, 'GitLab CI');

  const buildJobCommand = resolveJobCommandBuilder(mavenBinOrBuilder);
  const jobsYaml = jobs.map((job) => renderGitLabJob(job, buildJobCommand)).join('\n');

  const constraintsComment = resourceConstraints
    ? `# Resource constraints captured during profiling\n# Keep baseline and optimized runs on identical container config\n# cpu_limit: ${resourceConstraints.cpuCores}\n# memory_limit_mb: ${resourceConstraints.memoryLimitMb ?? 'unknown'}\n`
    : '';

  const yamlOutput = `${constraintsComment}stages:
  - test
${jobsYaml}
`;

  validateYamlSyntax(yamlOutput);

  // Commit: validation scaffolding (no-op)
  const validator = getSchemaValidator('gitlab');
  validator?.validate(yamlOutput);

  return yamlOutput;
}

export function buildGitLabSplitJobs(
  baseJob: JsonObject,
  jobs: { id: number; tests: string[]; needs?: number[] }[],
  testCommand: string,
  runnerCores: number = 1,
  containerImage?: string,
  services?: ServiceRequirement[],
  hasDockerCompose?: boolean,
): Record<string, JsonObject> {
  const splitJobs: Record<string, JsonObject> = {};

  const gitlabServices = services ? buildGitLabServices(services) : undefined;
  const composeLines = hasDockerCompose ? buildDockerComposeBeforeScript() : [];

  const coreDetectLines = runnerCores > 1 ? [
    'export TOTAL=$(nproc)',
    "export LOAD=$(awk '{print int($1+0.5)}' /proc/loadavg)",
    'export IDLE=$(( TOTAL - LOAD > 1 ? TOTAL - LOAD : 1 ))',
  ] : [];

  const forkSuffix = runnerCores > 1
    ? ' -Dsurefire.forkCount=$IDLE -Dsurefire.reuseForks=true'
    : '';

  for (const job of jobs) {
    const clonedJob = JSON.parse(JSON.stringify(baseJob));

    if (containerImage) clonedJob.image = containerImage;
    if (gitlabServices) clonedJob.services = gitlabServices;

    const existingBefore = Array.isArray(clonedJob.before_script) ? clonedJob.before_script : [];
    const beforeScript = [...composeLines, ...coreDetectLines, ...existingBefore];
    if (beforeScript.length > 0) clonedJob.before_script = beforeScript;

    const scriptLines = Array.isArray(clonedJob.script)
      ? clonedJob.script
      : [clonedJob.script];

    clonedJob.script = scriptLines.map((line: string) => {
      if (isMavenCommand(line) ? isMavenTestCommand(line) : line.toLowerCase().includes('test')) {
        return `${testCommand} ${job.tests.join(' ')}${forkSuffix}`.trim();
      }
      return line;
    });

    splitJobs[`job-${job.id}`] = clonedJob;
  }

  return splitJobs;
}
