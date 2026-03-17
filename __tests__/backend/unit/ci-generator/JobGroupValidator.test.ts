import { validateJobGroups } from '../../../../src/backend/generator/JobGroupValidator';
import { JobGroup } from '../../../../src/backend/generator/JobGroup';

describe('validateJobGroups', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('warns when GitHub job count exceeds platform limit', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const jobs: JobGroup[] = Array.from({ length: 257 }, (_, index) => ({
      id: index + 1,
      tests: [`test-${index + 1}`],
    }));

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds recommended limit (256)'),
    );
  });

  it('warns when tests per job exceed platform limit', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const jobs: JobGroup[] = [
      {
        id: 1,
        tests: Array.from({ length: 1001 }, (_, index) => `test-${index + 1}`),
      },
    ];

    expect(() => validateJobGroups(jobs, 'GitLab CI')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds recommended per-job limit (1000)'),
    );
  });
});
