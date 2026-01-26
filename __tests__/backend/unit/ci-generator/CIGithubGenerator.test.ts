import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';

describe('GitHubActionsGenerator', () => {
  test('generates a workflow with one job per group', () => {
    const yaml = generateGitHubActionsConfig([
      { id: 1, tests: ['TestA', 'TestB'] },
      { id: 2, tests: ['TestC'] },
    ]);

    expect(yaml).toContain('name: TestSplit CI');
    expect(yaml).toContain('job-1:');
    expect(yaml).toContain('job-2:');
    expect(yaml).toContain('npm test -- TestA TestB');
    expect(yaml).toContain('npm test -- TestC');
  });

  test('throws when no jobs are provided', () => {
    expect(() => generateGitHubActionsConfig([])).toThrow(
      'No jobs provided for GitHub Actions configuration',
    );
  });

  test('throws when a job has no tests', () => {
    expect(() => generateGitHubActionsConfig([{ id: 1, tests: [] }])).toThrow(
      'Job 1 has no tests assigned',
    );
  });
});
