import { validateJobGroups } from '../../../../src/backend/generator/JobGroupValidator';
import { JobGroup } from '../../../../src/backend/generator/JobGroup';

describe('validateJobGroups', () => {
  it('does not throw when jobs are valid', () => {
    const jobs: JobGroup[] = [
      { id: 1, tests: ['testA', 'testB'] },
      { id: 2, tests: ['testC'] },
    ];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).not.toThrow();
  });

  it('throws when job list is empty', () => {
    const jobs: JobGroup[] = [];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'No jobs provided for GitHub Actions configuration',
    );
  });

  it('throws when a job has no tests', () => {
    const jobs: JobGroup[] = [{ id: 1, tests: [] }];

    expect(() => validateJobGroups(jobs, 'GitLab CI')).toThrow(
      'Job 1 has no tests assigned',
    );
  });

  it('throws when a job depends on an unknown job id', () => {
    const jobs: JobGroup[] = [
      { id: 1, tests: ['testA'] },
      { id: 2, tests: ['testB'], needs: [3] },
    ];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'Job 2 depends on unknown job 3',
    );
  });
});
