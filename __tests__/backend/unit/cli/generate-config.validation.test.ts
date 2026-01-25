import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../../../src/backend/cli/cli.ts');

describe('CLI generate-config output path validation', () => {
  test('fails when output directory does not exist', () => {
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
        'nonexistent-dir/ci.yml',
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      'Error: output directory does not exist',
    );
  });

  test('fails when --out is a directory', () => {
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
        '.',
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      'Error: --out must be a file path',
    );
  });
});
