import { JobGroup } from './JobGroup';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';

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

  const yamlOutput = `name: TestSplit CI

on: [push, pull_request]

jobs:${jobsYaml}
`;

  const validator = getSchemaValidator('github');
  validator?.validate(yamlOutput);

  return yamlOutput;
}
