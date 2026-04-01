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

  it('throws when needs declaration is not an array', () => {
    const jobs = [{ id: 1, tests: ['testA'], needs: '2' as any }] as JobGroup[];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'Job 1 has invalid needs declaration',
    );
  });

  it('throws when dependency id is not an integer', () => {
    const jobs = [
      { id: 1, tests: ['testA'] },
      { id: 2, tests: ['testB'], needs: [1.5] as any },
    ] as JobGroup[];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'Job 2 has non-integer dependency id',
    );
  });

  it('throws when a job depends on itself', () => {
    const jobs: JobGroup[] = [
      { id: 1, tests: ['testA'], needs: [1] },
    ];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'Job 1 cannot depend on itself',
    );
  });

  it('throws when a job depends on an unknown job id', () => {
    const jobs: JobGroup[] = [
      { id: 1, tests: ['testA'] },
      { id: 2, tests: ['testB'], needs: [99] },
    ];

    expect(() => validateJobGroups(jobs, 'GitHub Actions')).toThrow(
      'Job 2 depends on unknown job 99',
    );
  });

  it('returns without platform limit warnings for unknown platform names', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const jobs: JobGroup[] = [
      { id: 1, tests: ['testA'] },
    ];

    expect(() => validateJobGroups(jobs, 'CircleCI')).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
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
