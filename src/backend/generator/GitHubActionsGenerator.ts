export interface JobGroup {
  id: number;
  tests: string[];
}

function renderGitHubJob(job: JobGroup): string {
  return `
  job-${job.id}:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test -- ${job.tests.join(' ')}`;
}

export function generateGitHubActionsConfig(jobs: JobGroup[]): string {
  if (jobs.length === 0) {
    throw new Error('No jobs provided for GitHub Actions configuration');
  }

  for (const job of jobs) {
    if (job.tests.length === 0) {
      throw new Error(`Job ${job.id} has no tests assigned`);
    }
  }

  const jobsYaml = jobs.map(renderGitHubJob).join('\n');

  return `name: TestSplit CI

on: [push, pull_request]

jobs:${jobsYaml}
`;
}
