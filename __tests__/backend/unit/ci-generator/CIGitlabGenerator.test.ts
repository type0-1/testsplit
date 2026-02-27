import { generateGitLabCIConfig } from '../../../../src/backend/generator/GitLabCIGenerator';

describe('GitLabCIGenerator', () => {
  test('generates a GitLab CI config with one job per test group', () => {
    const yaml = generateGitLabCIConfig([
      { id: 1, tests: ['TestA', 'TestB'] },
      { id: 2, tests: ['TestC'] },
    ]);

    expect(yaml).toContain('stages:');
    expect(yaml).toContain('- test');

    expect(yaml).toContain('job-1:');
    expect(yaml).toContain('job-2:');

    expect(yaml).toContain('mvn test -Dtest=TestA,TestB');
    expect(yaml).toContain('mvn test -Dtest=TestC');
  });

  test('uses custom maven binary when provided', () => {
    const yaml = generateGitLabCIConfig(
      [{ id: 1, tests: ['TestA', 'TestB'] }],
      './mvnw',
    );

    expect(yaml).toContain('./mvnw test -Dtest=TestA,TestB');
  });

  test('throws when no jobs are provided', () => {
    expect(() => generateGitLabCIConfig([])).toThrow(
      'No jobs provided for GitLab CI configuration',
    );
  });

  test('throws when a job has no tests', () => {
    expect(() => generateGitLabCIConfig([{ id: 1, tests: [] }])).toThrow(
      'Job 1 has no tests assigned',
    );
  });

  test('throws when generated YAML is syntactically invalid', () => {
    expect(() =>
      generateGitLabCIConfig([{ id: 1, tests: ['TestA\ninvalid: ['] }]),
    ).toThrow('Invalid YAML generated:');
  });
});
