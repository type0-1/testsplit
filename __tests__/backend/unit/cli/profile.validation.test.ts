import { spawnSync } from 'child_process';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../../../src/backend/cli/cli.ts');

describe('CLI profile validation', () => {
  test('fails when jobs is invalid', () => {
    const result = spawnSync(
      'npx',
      [
        'ts-node',
        CLI_PATH,
        'profile',
        '--junit',
        '__tests__/backend/integration/core/fixtures/surefire-reports',
        '--jobs',
        '-1',
      ],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      'Error: --jobs must be a positive integer',
    );
  });

  test('fails when junit path does not exist', () => {
    const result = spawnSync(
      'npx',
      ['ts-node', CLI_PATH, 'profile', '--junit', 'fake/path', '--jobs', '2'],
      { encoding: 'utf-8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain(
      'Error: JUnit path does not exist',
    );
  });
});
