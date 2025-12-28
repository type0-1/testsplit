export interface JobGroup {
  id: number;
  tests: string[];
}

export function generateGitLabCIConfig(jobs: JobGroup[]): string {
  const jobsYaml = jobs
    .map(
      (job) => `
job-${job.id}:
  stage: test
  script:
    - npm test -- ${job.tests.join(' ')}`,
    )
    .join('\n');

  return `stages:
  - test
${jobsYaml}
`;
}
