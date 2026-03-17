import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';
import { getSchemaValidator } from '../../../../src/backend/generator/getSchemaValidator';
import { validateJobGroups } from '../../../../src/backend/generator/JobGroupValidator';
import { JobGroup } from '../../../../src/backend/generator/JobGroup';

describe('CI validation features', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('YAML syntax errors are caught', () => {
    expect(() =>
      generateGitHubActionsConfig([{ id: 1, tests: ['TestA\ninvalid: ['] }]),
    ).toThrow('Invalid YAML generated:');
  });

  test('schema violations are detected', () => {
    const validator = getSchemaValidator('github');

    expect(() =>
      validator!.validate(`name: TestSplit CI
on: [push, pull_request]
jobs: []
`),
    ).toThrow('GitHub Actions schema violation: "jobs" must be an object');
  });

  test('platform limits trigger warnings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const jobs: JobGroup[] = Array.from({ length: 257 }, (_, index) => ({
      id: index + 1,
      tests: [`test-${index + 1}`],
    }));

    validateJobGroups(jobs, 'GitHub Actions');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('exceeds recommended limit (256)'),
    );
  });
});
