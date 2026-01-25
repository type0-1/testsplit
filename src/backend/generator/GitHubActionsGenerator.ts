export interface JobGroup {
  id: number;
  tests: string[];
}

export function generateGitHubActionsConfig(jobs: JobGroup[]): string {
  if (jobs.length === 0) {
    throw new Error('No jobs provided for GitHub Actions configuration');
  }
  const jobsYaml = jobs
    .map(
      (job) => `
  job-${job.id}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test -- ${job.tests.join(' ')}`,
    )
    .join('\n');

  return `name: TestSplit CI

on: [push, pull_request]

jobs:${jobsYaml}
`;
}
