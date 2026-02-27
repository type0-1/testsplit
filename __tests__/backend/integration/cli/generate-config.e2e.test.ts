import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

const CLI_PATH = path.resolve(__dirname, '../../../../src/backend/cli/cli.ts');

describe('generate-config CLI integration', () => {
  test('generates CI YAML with expected job count and Maven -Dtest commands', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-generate-'));
    const outPath = path.join(tempDir, 'testsplit.yml');

    try {
      const result = spawnSync(
        'npx',
        [
          'ts-node',
          CLI_PATH,
          'generate-config',
          '--junit',
          '__tests__/backend/integration/core/fixtures/surefire-reports',
          '--jobs',
          '2',
          '--platform',
          'github',
          '--out',
          outPath,
        ],
        { encoding: 'utf-8' },
      );

      expect(result.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const yamlOutput = fs.readFileSync(outPath, 'utf-8');
      const parsed = YAML.parse(yamlOutput);

      expect(yamlOutput).toContain(
        '# Resource constraints captured during profiling',
      );
      expect(yamlOutput).toContain('# cpu_limit:');
      expect(yamlOutput).toContain('# memory_limit_mb:');

      expect(parsed.jobs).toBeDefined();

      const jobNames = Object.keys(parsed.jobs);
      expect(jobNames).toHaveLength(2);

      for (const jobName of jobNames) {
        const runCommand = parsed.jobs[jobName].steps[1].run as string;
        expect(runCommand).toMatch(/^mvn test -Dtest=.+$/);
        expect(runCommand).not.toContain('npm test');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
