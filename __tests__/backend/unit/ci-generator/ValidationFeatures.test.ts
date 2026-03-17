import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';
import { getSchemaValidator } from '../../../../src/backend/generator/getSchemaValidator';

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

});
