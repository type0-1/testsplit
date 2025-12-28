export interface JobGroup {
  id: number;
  tests: string[];
}

export function generateGitHubActionsConfig(jobs: JobGroup[]): string {
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
