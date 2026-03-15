import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const CLI_PATH = path.resolve(__dirname, '../../../../src/backend/cli/cli.ts');

function runValidate(args: string[]) {
  return spawnSync('npx', ['ts-node', CLI_PATH, 'validate', ...args], {
    encoding: 'utf-8',
  });
}

function writeTempFile(content: string): string {
  const file = path.join(os.tmpdir(), `testsplit-validate-${Date.now()}.yml`);
  fs.writeFileSync(file, content, 'utf-8');
  return file;
}

describe('CLI validate command', () => {
  test('fails when --file does not exist', () => {
    const result = runValidate(['--file', 'nonexistent.yml']);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('does not exist');
  });

  test('fails on invalid YAML syntax', () => {
    const file = writeTempFile('key: [unclosed');
    const result = runValidate(['--file', file]);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('Invalid YAML syntax');
    fs.unlinkSync(file);
  });

  test('passes a valid GitHub Actions config', () => {
    const file = writeTempFile(`
    name: CI
    on: [push]
    jobs:
      job-1:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: mvn test -Dtest=MyTest
    `);
    const result = runValidate(['--file', file, '--platform', 'github']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('valid');
    fs.unlinkSync(file);
  });

  test('fails a GitHub Actions config missing jobs', () => {
    const file = writeTempFile(`name: CI\non: [push]\n`);
    const result = runValidate(['--file', file, '--platform', 'github']);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('jobs');
    fs.unlinkSync(file);
  });

  test('passes a valid GitLab CI config', () => {
    const file = writeTempFile(`
    stages:
      - test
    job-1:
      stage: test
      script:
        - mvn test -Dtest=MyTest
    `);
    const result = runValidate(['--file', file, '--platform', 'gitlab']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('valid');
    fs.unlinkSync(file);
  });

  test('fails a GitLab CI config missing stages', () => {
    const file = writeTempFile(`job-1:\n  script:\n    - mvn test\n`);
    const result = runValidate(['--file', file, '--platform', 'gitlab']);
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('stages');
    fs.unlinkSync(file);
  });
});
