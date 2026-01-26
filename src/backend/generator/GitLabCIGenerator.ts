import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';

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

  return `stages:
  - test
${jobsYaml}
`;
}
