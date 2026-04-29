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

  test('buildGitHubPhasedJobs with multi-core runner generates core detection and fork flags', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [{ uses: 'actions/checkout@v4' }],
    };

    const phased = buildGitHubPhasedJobs(
      baseJob,
      [{ id: 1, tests: ['TestA'] }],
      'mvn',
      'artifacts',
      'target/',
      4,
    );

    const testSteps = (phased['test-job-1'] as any).steps;
    const coreStep = testSteps.find((s: any) => s.name === 'Detect available cores');
    expect(coreStep).toBeDefined();
    expect(coreStep.id).toBe('cores');
    expect((coreStep as any).run).toContain('TOTAL=$(nproc)');

    const runStep = testSteps.find((s: any) => s.name === 'Run tests');
    expect((runStep as any).run).toContain('-Dsurefire.forkCount=${{ steps.cores.outputs.count }}');
    expect((runStep as any).run).toContain('-Dsurefire.reuseForks=true');
  });

  test('buildGitHubPhasedJobs with container image adds container to build and test jobs', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [{ uses: 'actions/checkout@v4' }],
    };

    const phased = buildGitHubPhasedJobs(
      baseJob,
      [{ id: 1, tests: ['TestA'] }],
      'mvn',
      'artifacts',
      'target/',
      1,
      'node:18-alpine',
    );

    expect((phased['build'] as any).container).toBe('node:18-alpine');
    expect((phased['test-job-1'] as any).container).toBe('node:18-alpine');
  });

  test('buildGitHubPhasedJobs without services or compose does not add them to jobs', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [{ uses: 'actions/checkout@v4' }],
    };

    const phased = buildGitHubPhasedJobs(
      baseJob,
      [{ id: 1, tests: ['TestA'] }],
      'mvn',
    );

    expect((phased['build'] as any).services).toBeUndefined();
    expect((phased['test-job-1'] as any).services).toBeUndefined();

    const testSteps = (phased['test-job-1'] as any).steps;
    expect(testSteps.every((s: any) => s.name !== 'Start services')).toBe(true);
    expect(testSteps.every((s: any) => s.name !== 'Stop services')).toBe(true);
  });

  test('renderGitHubJob includes needs clause when job dependencies are present', () => {
    const yaml = generateGitHubActionsConfig([
      { id: 1, tests: ['TestA'] },
      { id: 2, tests: ['TestB'], needs: [1] },
    ]);

    expect(yaml).toContain('job-2:\n    runs-on: ubuntu-latest\n    needs: [job-1]');
  });

  test('buildGitHubPhasedJobs extracts and substitutes matrix references from env vars', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      strategy: {
        matrix: {
          java: ['11', '17', '21'],
          os: ['ubuntu-latest', 'windows-latest'],
        },
      },
      steps: [
        { uses: 'actions/checkout@v4' },
        { run: 'echo $JAVA_VERSION' },
      ],
      env: {
        JAVA_VERSION: '${{ matrix.java }}',
        OS: '${{ matrix.os }}',
        STATIC_VAR: 'keep-me',
      },
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const buildEnv = (phased['build'] as any).env;
    expect(buildEnv).toBeDefined();
    expect(buildEnv.STATIC_VAR).toBe('keep-me');
    expect(buildEnv.JAVA_VERSION).toBeUndefined();
  });

  test('buildGitHubPhasedJobs filters and resolves only non-maven steps into setup', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [
        { uses: 'actions/checkout@v4' },
        { name: 'Setup', run: 'apt-get update' },
        { name: 'Run tests', run: 'mvn test' },
        { name: 'Report', run: 'echo done' },
      ],
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const testSteps = (phased['test-job-1'] as any).steps;
    const setupStepNames = testSteps.filter((s: any) => !s.uses || !s.uses.includes('download-artifact')).map((s: any) => s.name);
    expect(setupStepNames).toContain('Setup');
    expect(setupStepNames).toContain('Report');
    expect(setupStepNames.some((n: any) => n && n.includes('mvn'))).toBe(false);
  });

  test('buildGitHubPhasedJobs adds -DskipTests to maven steps in build job', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [
        { uses: 'actions/checkout@v4' },
        { run: 'mvn clean compile' },
      ],
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const buildSteps = (phased['build'] as any).steps;
    const mvnStep = buildSteps.find((s: any) => s.run && s.run.includes('mvn'));
    expect((mvnStep as any).run).toContain('-DskipTests');
    expect((mvnStep as any).run).toContain('-Drat.skip=true');
  });

  test('buildGitHubPhasedJobs handles base job without steps array', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    expect(phased['build']).toBeDefined();
    expect((phased['build'] as any).steps).toBeDefined();
    expect(Array.isArray((phased['build'] as any).steps)).toBe(true);
  });

  test('buildGitHubPhasedJobs handles base job without env and collects no substitutions', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      steps: [{ run: 'echo test' }],
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const testSteps = (phased['test-job-1'] as any).steps;
    const runStep = testSteps.find((s: any) => s.name === 'Run tests');
    expect((runStep as any).run).toContain('-Dtest=TestA');
  });

  test('buildGitHubPhasedJobs removes strategy from base job', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      strategy: { matrix: { java: ['11', '17'] } },
      steps: [],
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    expect((phased['build'] as any).strategy).toBeUndefined();
    expect((phased['test-job-1'] as any).strategy).toBeUndefined();
  });

  test('buildGitHubPhasedJobs resolves env substitutions in test job steps', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      strategy: {
        matrix: {
          java: ['11', '17'],
        },
      },
      steps: [
        { uses: 'actions/checkout@v4' },
        { run: 'echo Testing with $MY_VERSION' },
      ],
      env: {
        MY_VERSION: '${{ matrix.java }}',
        STATIC: 'value',
      },
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const testSteps = (phased['test-job-1'] as any).steps;
    const echoStep = testSteps.find((s: any) => s.run && s.run.includes('echo Testing'));
    expect((echoStep as any).run).toBe('echo Testing with 17');
  });

  test('buildGitHubPhasedJobs removes env entirely when all env vars are matrix references', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      strategy: {
        matrix: {
          java: ['11', '17'],
        },
      },
      steps: [{ uses: 'actions/checkout@v4' }],
      env: {
        ONLY_MATRIX_VAR: '${{ matrix.java }}',
      },
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    expect((phased['build'] as any).env).toBeUndefined();
  });

  test('buildGitHubPhasedJobs resolves undefined or empty matrix references to empty string', () => {
    const baseJob = {
      'runs-on': 'ubuntu-latest',
      strategy: {
        matrix: {
          java: ['11', '17'],
        },
      },
      steps: [
        { uses: 'actions/checkout@v4' },
        { run: 'echo Missing: ${{ matrix.unknown }} End' },
      ],
    };

    const phased = buildGitHubPhasedJobs(baseJob, [{ id: 1, tests: ['TestA'] }], 'mvn');

    const testSteps = (phased['test-job-1'] as any).steps;
    const echoStep = testSteps.find((s: any) => s.run && s.run.includes('Missing:'));
    expect((echoStep as any).run).toBe('echo Missing:  End');
  });


});
