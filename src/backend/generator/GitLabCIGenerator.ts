export interface JobGroup {
  id: number;
  tests: string[];
}

function renderGitLabJob(job: JobGroup): string {
  return `
job-${job.id}:
  stage: test
  script:
    - npm test -- ${job.tests.join(' ')}`;
}

export function generateGitLabCIConfig(jobs: JobGroup[]): string {
  if (jobs.length === 0) {
    throw new Error('No jobs provided for GitLab CI configuration');
  }
  const jobsYaml = jobs.map(renderGitLabJob).join('\n');

  return `stages:
  - test
${jobsYaml}
`;
}
