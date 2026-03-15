import { generateGitLabCIConfig } from '../../../../src/backend/generator/GitLabCIGenerator';
import YAML from 'yaml';

describe('GitLabCIGenerator', () => {
  test('generates correct YAML structure, job count, and mvn commands', () => {
    const yaml = generateGitLabCIConfig([
      { id: 1, tests: ['TestA', 'TestB'] },
      { id: 2, tests: ['TestC'] },
    ]);

    const parsed = YAML.parse(yaml);
    const jobNames = Object.keys(parsed).filter((key) => key !== 'stages');

    expect(parsed.stages).toEqual(['test']);
    expect(jobNames).toHaveLength(2);
    expect(parsed['job-1'].script[0]).toBe('mvn test -Dtest=TestA,TestB');
    expect(parsed['job-2'].script[0]).toBe('mvn test -Dtest=TestC');
  });

  test('supports fully-qualified classnames in -Dtest format', () => {
    const fqcn = 'org.apache.commons.lang3.StringUtils#testIsEmpty';
    const yaml = generateGitLabCIConfig([{ id: 1, tests: [fqcn] }]);
    const parsed = YAML.parse(yaml);

    expect(parsed['job-1'].script[0]).toBe(`mvn test -Dtest=${fqcn}`);
  });

  test('documents profiling resource constraints in YAML comments', () => {
    const yaml = generateGitLabCIConfig([{ id: 1, tests: ['TestA'] }], 'mvn', {
      cpuCores: 2,
      memoryLimitMb: 2048,
    });

    expect(yaml).toContain('# Resource constraints captured during profiling');
    expect(yaml).toContain('# cpu_limit: 2');
    expect(yaml).toContain('# memory_limit_mb: 2048');
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
