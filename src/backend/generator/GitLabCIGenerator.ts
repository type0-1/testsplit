import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';

function renderGitLabJob(job: JobGroup): string {
  return `
job-${job.id}:
  stage: test
  script:
    - npm test -- ${job.tests.join(' ')}`;
}

export function generateGitLabCIConfig(jobs: JobGroup[]): string {
  validateJobGroups(jobs, 'GitLab CI');

  const jobsYaml = jobs.map(renderGitLabJob).join('\n');

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
