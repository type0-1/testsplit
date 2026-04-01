import {
  buildGitLabSplitJobs,
  generateGitLabCIConfig,
} from '../../../../src/backend/generator/GitLabCIGenerator';
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

  test('supports a custom command builder function', () => {
    const commandBuilder = jest.fn((tests: string[]) => `./mvnw verify -Dtest=${tests.join('|')}`);

    const yaml = generateGitLabCIConfig(
      [{ id: 1, tests: ['TestA', 'TestB'] }],
      commandBuilder,
    );

    const parsed = YAML.parse(yaml);
    expect(commandBuilder).toHaveBeenCalledWith(['TestA', 'TestB']);
    expect(parsed['job-1'].script[0]).toBe('./mvnw verify -Dtest=TestA|TestB');
  });

  test('uses unknown memory comment when memory limit is unavailable', () => {
    const yaml = generateGitLabCIConfig([{ id: 1, tests: ['TestA'] }], 'mvn', {
      cpuCores: 2,
      memoryLimitMb: null,
    });

    expect(yaml).toContain('# memory_limit_mb: unknown');
  });

  test('buildGitLabSplitJobs adds services/image/compose/core lines and rewrites test command', () => {
    const baseJob = {
      script: ['echo setup', 'mvn test --batch-mode'],
      before_script: ['echo existing-before'],
    };

    const split = buildGitLabSplitJobs(
      baseJob,
      [{ id: 1, tests: ['A', 'B'] }],
      'mvn test -Dtest=',
      2,
      'eclipse-temurin:21-jdk',
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

    const job = split['job-1'];
    expect(job.image).toBe('eclipse-temurin:21-jdk');
    expect(job.services).toEqual(['postgres:15']);
    expect(job.before_script[0]).toBe('docker compose up -d');
    expect(job.before_script[1]).toBe('sleep 5');
    expect(job.before_script.some((line: string) => line.includes('nproc'))).toBe(true);
    expect(job.before_script[job.before_script.length - 1]).toBe('echo existing-before');
    expect(job.script[1]).toContain('mvn test -Dtest= A B');
    expect(job.script[1]).toContain('-Dsurefire.forkCount=$IDLE');
    expect(job.script[1]).toContain('-Dsurefire.reuseForks=true');
  });

  test('does not rewrite maven line already containing -DskipTests', () => {
    const split = buildGitLabSplitJobs(
      { script: ['mvn test -DskipTests'] },
      [{ id: 1, tests: ['A'] }],
      'mvn test -Dtest=',
    );

    expect(split['job-1'].script[0]).toBe('mvn test -DskipTests');
  });

  test('rewrites non-maven script lines that mention test', () => {
    const split = buildGitLabSplitJobs(
      { script: ['npm test'] },
      [{ id: 1, tests: ['A'] }],
      'npm run integration --tests',
    );

    expect(split['job-1'].script[0]).toBe('npm run integration --tests A');
  });

});
