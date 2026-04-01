import { getSchemaValidator } from '../../../../src/backend/generator/getSchemaValidator';

describe('CISchemaValidator', () => {
  test('validates minimal GitHub Actions schema', () => {
    const validator = getSchemaValidator('github');

    expect(validator).not.toBeNull();
    expect(() =>
      validator!.validate(`on: [push]
jobs:
  job-1:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`),
    ).not.toThrow();
  });

  test('detects GitHub schema violations', () => {
    const validator = getSchemaValidator('github');

    expect(() =>
      validator!.validate(`name: CI
on: [push]
`),
    ).toThrow('GitHub Actions schema violation: missing top-level "jobs"');
  });

  test('detects missing GitHub top-level "on"', () => {
    const validator = getSchemaValidator('github');

    expect(() =>
      validator!.validate(`name: CI
jobs:
  job-1:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`),
    ).toThrow('GitHub Actions schema violation: missing top-level "on"');
  });

  test('detects invalid GitHub jobs type and empty jobs', () => {
    const validator = getSchemaValidator('github');

    expect(() =>
      validator!.validate(`on: [push]
jobs: []
`),
    ).toThrow('GitHub Actions schema violation: "jobs" must be an object');

    expect(() =>
      validator!.validate(`on: [push]
jobs: {}
`),
    ).toThrow('GitHub Actions schema violation: "jobs" cannot be empty');
  });

  test('validates minimal GitLab CI schema', () => {
    const validator = getSchemaValidator('gitlab');

    expect(validator).not.toBeNull();
    expect(() =>
      validator!.validate(`stages:
  - test
job-1:
  stage: test
  script:
    - npm test
`),
    ).not.toThrow();
  });

  test('detects GitLab jobs without script blocks', () => {
    const validator = getSchemaValidator('gitlab');

    expect(() =>
      validator!.validate(`stages:
  - test
job-1:
  stage: test
`),
    ).toThrow(
      'GitLab CI schema violation: at least one job with "script" is required',
    );
  });

  test('detects missing or invalid GitLab stages', () => {
    const validator = getSchemaValidator('gitlab');

    expect(() =>
      validator!.validate(`job-1:
  stage: test
  script:
    - npm test
`),
    ).toThrow('GitLab CI schema violation: missing top-level "stages"');

    expect(() =>
      validator!.validate(`stages: []
job-1:
  stage: test
  script:
    - npm test
`),
    ).toThrow('GitLab CI schema violation: "stages" must be a non-empty array');
  });

  test('accepts GitLab jobs with non-empty string script and rejects blank string/empty array scripts', () => {
    const validator = getSchemaValidator('gitlab');

    expect(() =>
      validator!.validate(`stages:
  - test
job-1:
  stage: test
  script: "npm test"
`),
    ).not.toThrow();

    expect(() =>
      validator!.validate(`stages:
  - test
job-1:
  stage: test
  script: "   "
`),
    ).toThrow('GitLab CI schema violation: at least one job with "script" is required');

    expect(() =>
      validator!.validate(`stages:
  - test
job-1:
  stage: test
  script: []
`),
    ).toThrow('GitLab CI schema violation: at least one job with "script" is required');
  });

  test('ignores non-object and array job entries when scanning for script blocks', () => {
    const validator = getSchemaValidator('gitlab');

    expect(() =>
      validator!.validate(`stages:
  - test
job-1: []
job-2: 123
job-3:
  stage: test
`),
    ).toThrow('GitLab CI schema violation: at least one job with "script" is required');
  });

  test('rejects YAML roots that are not mapping objects', () => {
    const githubValidator = getSchemaValidator('github');

    expect(() => githubValidator!.validate('- just\n- a\n- list\n')).toThrow(
      'Invalid CI schema: YAML root must be a mapping/object',
    );
    expect(() => githubValidator!.validate('null')).toThrow(
      'Invalid CI schema: YAML root must be a mapping/object',
    );
  });

  test('returns null for unsupported platform', () => {
    const validator = getSchemaValidator('azure' as any);
    expect(validator).toBeNull();
  });
});
