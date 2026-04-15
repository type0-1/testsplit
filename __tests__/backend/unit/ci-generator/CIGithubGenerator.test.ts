import {
  buildGitHubPhasedJobs,
  generateGitHubActionsConfig,
} from '../../../../src/backend/generator/GitHubActionsGenerator';
import chalk from 'chalk';
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

  test('renders unknown memory limit in yellow when memory is unavailable', () => {
    const yaml = generateGitHubActionsConfig(
      [{ id: 1, tests: ['TestA'] }],
      'mvn',
      { cpuCores: 2, memoryLimitMb: null },
    );

    expect(yaml).toContain(`# memory_limit_mb: ${chalk.yellow('unknown')}`);
  });

  test('uses custom maven binary when provided', () => {
    const yaml = generateGitHubActionsConfig(
      [{ id: 1, tests: ['TestA', 'TestB'] }],
      './mvnw',
    );

    expect(yaml).toContain('./mvnw test -Dtest=TestA,TestB');
  });

  test('supports a custom command builder function', () => {
    const commandBuilder = jest.fn((tests: string[]) => `./mvnw verify -Dtest=${tests.join('|')}`);

    const yaml = generateGitHubActionsConfig(
      [{ id: 1, tests: ['TestA', 'TestB'] }],
      commandBuilder,
    );

    const parsed = YAML.parse(yaml);
    expect(commandBuilder).toHaveBeenCalledWith(['TestA', 'TestB']);
    expect(parsed.jobs['job-1'].steps[1].run).toBe('./mvnw verify -Dtest=TestA|TestB');
  });

  test('renders needs list as job-* identifiers when dependencies are present', () => {
    const yaml = generateGitHubActionsConfig([
      { id: 1, tests: ['TestA'] },
      { id: 2, tests: ['TestB'], needs: [1] },
    ]);

    const parsed = YAML.parse(yaml);
    expect(parsed.jobs['job-1'].needs).toBeUndefined();
    expect(parsed.jobs['job-2'].needs).toEqual(['job-1']);
  });

  test('buildGitHubPhasedJobs wires services, compose steps, and normalized test classes', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [
        { uses: 'actions/checkout@v4' },
        { name: 'Run tests', run: 'mvn test --batch-mode' },
      ],
    };

    const phased = buildGitHubPhasedJobs(
      baseJob,
      [{ id: 1, tests: ['com.example.ATest', 'com.example.BTest'] }],
      'mvn',
      'build-artifacts',
      'target/',
      1,
      undefined,
      [
        {
          type: 'postgres',
          image: 'postgres:15',
          source: 'testcontainers',
          ports: ['5432:5432'],
          env: { POSTGRES_PASSWORD: 'test' },
        },
      ],
      true,
    );

    expect(phased['build'].services).toEqual({
      postgres: {
        image: 'postgres:15',
        ports: ['5432:5432'],
        env: { POSTGRES_PASSWORD: 'test' },
      },
    });
    expect((phased['build'] as any).steps[1].run).toContain('-DskipTests');

    const testSteps = (phased['test-job-1'] as any).steps;
    expect(testSteps.some((s: any) => s.name === 'Start services')).toBe(true);
    expect(testSteps.some((s: any) => s.name === 'Stop services')).toBe(true);
    expect(phased['test-job-1'].needs).toEqual(['build']);

    const runStep = testSteps.find((s: any) => s.name === 'Run tests');
    expect((runStep as any).run).toContain('-Dtest=com.example.ATest,com.example.BTest');
    expect((runStep as any).run).toContain('-DfailIfNoTests=false');
  });

});
