import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const TS_NODE = path.resolve(PROJECT_ROOT, 'node_modules/.bin/ts-node');
const CLI_PATH = path.resolve(PROJECT_ROOT, 'src/backend/cli/cli.ts');
const JUNIT_FIXTURE = path.resolve(PROJECT_ROOT, '__tests__/backend/integration/core/fixtures/surefire-reports');
const CI_FIXTURE = path.resolve(__dirname, 'fixtures/github-maven.yml');
const COMMONS_LANG_JUNIT = path.resolve(__dirname, '../core/fixtures/commons-lang.xml');
const COMMONS_LANG_CI = path.resolve(__dirname, 'fixtures/commons-lang-maven.yml');

const SPAWN_OPTS = { encoding: 'utf-8' as const, cwd: PROJECT_ROOT };

jest.setTimeout(300_000); // ts-node cold-start can exceed 2 min on first run

describe('generate-config CLI integration', () => {
  test('generates split CI YAML preserving existing job structure with --from', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-generate-'));
    const outPath = path.join(tempDir, 'testsplit.yml');

    try {
      const result = spawnSync(
        TS_NODE,
        [
          '--transpile-only',
          CLI_PATH,
          'generate-config',
          '--junit', JUNIT_FIXTURE,
          '--jobs', '2',
          '--platform', 'github',
          '--from', CI_FIXTURE,
          '--out', outPath,
        ],
        SPAWN_OPTS,
      );

      if (result.status !== 0) console.error('CLI stderr:', result.stderr);
      expect(result.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const parsed = YAML.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(parsed.jobs).toBeDefined();

      const jobNames = Object.keys(parsed.jobs);
      // build + 2 test jobs
      expect(jobNames).toHaveLength(3);
      expect(jobNames).toContain('build');

      const testJobNames = jobNames.filter((n) => n.startsWith('test-job-'));
      expect(testJobNames).toHaveLength(2);

      // Build job: original setup steps + compile-only Maven + artifact upload
      const buildSteps = parsed.jobs['build'].steps as any[];
      expect(buildSteps.some((s: any) => s.uses?.startsWith('actions/checkout'))).toBe(true);
      expect(buildSteps.some((s: any) => s.uses?.startsWith('actions/setup-java'))).toBe(true);
      const buildMavenStep = buildSteps.find((s: any) => typeof s.run === 'string' && s.run.includes('mvn'));
      expect(buildMavenStep).toBeDefined();
      expect(buildMavenStep.run).toContain('-DskipTests');
      expect(buildSteps.some((s: any) => s.uses?.startsWith('actions/upload-artifact'))).toBe(true);

      // Test jobs: setup steps + artifact download + scoped test command
      for (const jobName of testJobNames) {
        const steps = parsed.jobs[jobName].steps as any[];
        expect(steps.some((s: any) => s.uses?.startsWith('actions/checkout'))).toBe(true);
        expect(steps.some((s: any) => s.uses?.startsWith('actions/setup-java'))).toBe(true);
        expect(steps.some((s: any) => s.uses?.startsWith('actions/download-artifact'))).toBe(true);
        const testStep = steps.find((s: any) => typeof s.run === 'string' && s.run.includes('-Dtest='));
        expect(testStep).toBeDefined();
        expect(testStep.run).toMatch(/mvn test -Dtest=.+ -DfailIfNoTests=false/);
        expect(parsed.jobs[jobName].needs).toContain('build');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('handles commons-lang style Maven CI (no "test" keyword in Maven step)', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-generate-'));
    const outPath = path.join(tempDir, 'testsplit.yml');

    try {
      const result = spawnSync(
        TS_NODE,
        [
          '--transpile-only',
          CLI_PATH,
          'generate-config',
          '--junit', COMMONS_LANG_JUNIT,
          '--jobs', '3',
          '--platform', 'github',
          '--from', COMMONS_LANG_CI,
          '--out', outPath,
        ],
        SPAWN_OPTS,
      );

      if (result.status !== 0) console.error('CLI stderr:', result.stderr);
      expect(result.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const parsed = YAML.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(parsed.jobs).toBeDefined();

      const jobNames = Object.keys(parsed.jobs);
      // build + 3 test jobs
      expect(jobNames).toHaveLength(4);
      expect(jobNames).toContain('build');

      const testJobNames = jobNames.filter((n) => n.startsWith('test-job-'));
      expect(testJobNames).toHaveLength(3);

      // Build job must compile with -DskipTests and upload artifacts
      const buildSteps = parsed.jobs['build'].steps as any[];
      const buildMavenStep = buildSteps.find((s: any) => typeof s.run === 'string' && s.run.includes('mvn'));
      expect(buildMavenStep).toBeDefined();
      expect(buildMavenStep.run).toContain('-DskipTests');
      expect(buildSteps.some((s: any) => s.uses?.startsWith('actions/upload-artifact'))).toBe(true);

      for (const jobName of testJobNames) {
        const steps = parsed.jobs[jobName].steps as any[];

        // Setup steps preserved
        expect(steps.some((s: any) => s.uses?.startsWith('actions/checkout'))).toBe(true);
        expect(steps.some((s: any) => s.uses?.startsWith('actions/setup-java'))).toBe(true);

        // Artifact download present
        expect(steps.some((s: any) => s.uses?.startsWith('actions/download-artifact'))).toBe(true);

        // Test step has -Dtest= subset
        const testStep = steps.find((s: any) => typeof s.run === 'string' && s.run.includes('-Dtest='));
        expect(testStep).toBeDefined();
        expect(testStep.run).toMatch(/mvn test -Dtest=.+ -DfailIfNoTests=false/);

        // Each test job depends on build
        expect(parsed.jobs[jobName].needs).toContain('build');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('exits with error when no --from given and no CI file auto-detected', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-generate-'));
    const outPath = path.join(tempDir, 'testsplit.yml');

    try {
      const result = spawnSync(
        TS_NODE,
        [
          '--transpile-only',
          CLI_PATH,
          'generate-config',
          '--junit', JUNIT_FIXTURE,
          '--jobs', '2',
          '--platform', 'github',
          '--out', outPath,
        ],
        { ...SPAWN_OPTS, cwd: tempDir },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('No CI config found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
