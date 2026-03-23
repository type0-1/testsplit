import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

const CLI_PATH = path.resolve(__dirname, '../../../../src/backend/cli/cli.ts');
const JUNIT_FIXTURE = '__tests__/backend/integration/core/fixtures/surefire-reports';
const CI_FIXTURE = path.resolve(__dirname, 'fixtures/github-maven.yml');

describe('generate-config CLI integration', () => {
  test('generates split CI YAML preserving existing job structure with --from', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-generate-'));
    const outPath = path.join(tempDir, 'testsplit.yml');

    try {
      const result = spawnSync(
        'npx',
        [
          'ts-node',
          CLI_PATH,
          'generate-config',
          '--junit', JUNIT_FIXTURE,
          '--jobs', '2',
          '--platform', 'github',
          '--from', CI_FIXTURE,
          '--out', outPath,
        ],
        { encoding: 'utf-8' },
      );

      expect(result.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const parsed = YAML.parse(fs.readFileSync(outPath, 'utf-8'));

      expect(parsed.jobs).toBeDefined();

      const jobNames = Object.keys(parsed.jobs);
      expect(jobNames).toHaveLength(2);

      for (const jobName of jobNames) {
        const steps = parsed.jobs[jobName].steps as any[];
        // Original non-test steps are preserved
        expect(steps.some((s: any) => s.uses?.startsWith('actions/checkout'))).toBe(true);
        expect(steps.some((s: any) => s.uses?.startsWith('actions/setup-java'))).toBe(true);
        // Test step has the original command with test subset injected
        const testStep = steps.find((s: any) => typeof s.run === 'string' && s.run.includes('mvn test'));
        expect(testStep).toBeDefined();
        expect(testStep.run).toMatch(/mvn test.*--batch-mode.*--no-transfer-progress/);
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
        'npx',
        [
          'ts-node',
          CLI_PATH,
          'generate-config',
          '--junit', JUNIT_FIXTURE,
          '--jobs', '2',
          '--platform', 'github',
          '--out', outPath,
        ],
        { encoding: 'utf-8', cwd: tempDir },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('No CI config found');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
