import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import type { CIResourceConstraints } from './GitHubActionsGenerator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';

function renderGitLabJob(job: JobGroup, mavenBin: string): string {
  return `
job-${job.id}:
  stage: test
  script:
    - ${mavenBin} test -Dtest=${job.tests.join(',')}`;
}

export function generateGitLabCIConfig(
  jobs: JobGroup[],
  mavenBin: string = 'mvn',
  resourceConstraints?: CIResourceConstraints,
): string {
  validateJobGroups(jobs, 'GitLab CI');

  const jobsYaml = jobs.map((job) => renderGitLabJob(job, mavenBin)).join('\n');

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
