import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';
import YAML from 'yaml';

describe('GitHubActionsGenerator', () => {
  test('generates correct YAML structure, job count, and mvn commands', () => {
    const yaml = generateGitHubActionsConfig([
      { id: 1, tests: ['TestA', 'TestB'] },
      { id: 2, tests: ['TestC'], needs: [1] },
    ]);

    const parsed = YAML.parse(yaml);

    expect(parsed.name).toBe('TestSplit CI');
    expect(parsed.on).toEqual(['push', 'pull_request']);
    expect(parsed.jobs).toBeDefined();
    expect(Object.keys(parsed.jobs)).toHaveLength(2);
    expect(parsed.jobs['job-1'].steps[1].run).toBe(
      'mvn test -Dtest=TestA,TestB',
    );
    expect(parsed.jobs['job-2'].steps[1].run).toBe('mvn test -Dtest=TestC');
  });

  test('supports fully-qualified classnames in -Dtest format', () => {
    const fqcn = 'org.apache.commons.lang3.StringUtils#testIsEmpty';
    const yaml = generateGitHubActionsConfig([{ id: 1, tests: [fqcn] }]);
    const parsed = YAML.parse(yaml);

    expect(parsed.jobs['job-1'].steps[1].run).toBe(`mvn test -Dtest=${fqcn}`);
  });

  test('documents profiling resource constraints in YAML comments', () => {
    const yaml = generateGitHubActionsConfig(
      [{ id: 1, tests: ['TestA'] }],
      'mvn',
      { cpuCores: 2, memoryLimitMb: 2048 },
    );

    expect(yaml).toContain('# Resource constraints captured during profiling');
    expect(yaml).toContain('# cpu_limit: 2');
    expect(yaml).toContain('# memory_limit_mb: 2048');
  });

  test('uses custom maven binary when provided', () => {
    const yaml = generateGitHubActionsConfig(
      [{ id: 1, tests: ['TestA', 'TestB'] }],
      './mvnw',
    );

    expect(yaml).toContain('./mvnw test -Dtest=TestA,TestB');
  });

});
