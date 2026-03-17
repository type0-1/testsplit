import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import type { CIResourceConstraints } from './GitHubActionsGenerator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';

type JobCommandBuilder = (tests: string[]) => string;

function resolveJobCommandBuilder(
  mavenBinOrBuilder: string | JobCommandBuilder,
): JobCommandBuilder {
  if (typeof mavenBinOrBuilder === 'function') {
    return mavenBinOrBuilder;
  }

  return (tests: string[]) => `${mavenBinOrBuilder} test -Dtest=${tests.join(',')}`;
}

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
