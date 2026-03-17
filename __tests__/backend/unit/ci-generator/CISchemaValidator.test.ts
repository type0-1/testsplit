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

  test('detects GitLab schema violations', () => {
    const validator = getSchemaValidator('gitlab');

    expect(() =>
      validator!.validate(`stages:
  - test
`),
    ).toThrow(
      'GitLab CI schema violation: at least one job with "script" is required',
    );
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
});
