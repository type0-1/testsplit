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

    expect(yaml).toContain('npm test -- TestA TestB');
    expect(yaml).toContain('npm test -- TestC');
  });

});
