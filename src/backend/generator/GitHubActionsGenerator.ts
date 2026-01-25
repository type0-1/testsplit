import { validateJobGroups } from './JobGroupValidator';
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
  validateJobGroups(jobs, 'GitHub Actions');

  const jobsYaml = jobs.map(renderGitHubJob).join('\n');

  return `name: TestSplit CI

on: [push, pull_request]

jobs:${jobsYaml}
`;
}
