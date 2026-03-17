import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';

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
