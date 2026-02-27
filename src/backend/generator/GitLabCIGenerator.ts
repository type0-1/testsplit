import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
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
): string {
  validateJobGroups(jobs, 'GitLab CI');

  const jobsYaml = jobs.map((job) => renderGitLabJob(job, mavenBin)).join('\n');

  const yamlOutput = `stages:
  - test
${jobsYaml}
`;

  validateYamlSyntax(yamlOutput);

  // Commit: validation scaffolding (no-op)
  const validator = getSchemaValidator('gitlab');
  validator?.validate(yamlOutput);

  return yamlOutput;
}
