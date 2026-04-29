import { findTestJobs, extractTestCommands, findExistingCIFile } from '../../../../src/backend/cli/CIConfigReader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeGitHubConfig(steps: any[], jobName = 'build') {
  return {
    jobs: {
      [jobName]: { steps },
    },
  };
}

describe('findTestJobs GitHub', () => {
  it('detects Maven mvn test step', () => {
    const config = makeGitHubConfig([{ run: 'mvn test' }], 'java');
    expect(findTestJobs(config, 'github')).toEqual(['java']);
  });

  it('ignores Maven step with -DskipTests', () => {
    const config = makeGitHubConfig([{ run: 'mvn install -DskipTests' }], 'java');
    expect(findTestJobs(config, 'github')).toEqual([]);
  });

  it('detects ./gradlew test', () => {
    const config = makeGitHubConfig([{ run: './gradlew test' }], 'jvm');
    expect(findTestJobs(config, 'github')).toEqual(['jvm']);
  });

  it('detects ./gradlew build', () => {
    const config = makeGitHubConfig([{ run: './gradlew build --stacktrace' }], 'java');
    expect(findTestJobs(config, 'github')).toEqual(['java']);
  });

  it('detects ./gradlew check', () => {
    const config = makeGitHubConfig([{ run: './gradlew check' }], 'java');
    expect(findTestJobs(config, 'github')).toEqual(['java']);
  });

  it('ignores ./gradlew build -x test', () => {
    const config = makeGitHubConfig([{ run: './gradlew build -x test' }], 'java');
    expect(findTestJobs(config, 'github')).toEqual([]);
  });

  it('detects multiline gradlew build (YAML folded scalar)', () => {
    // YAML > folds newlines to spaces  simulate that here
    const config = makeGitHubConfig([
      { run: './gradlew -Pmockito.test.java=17 build --stacktrace --scan' },
    ], 'java');
    expect(findTestJobs(config, 'github')).toEqual(['java']);
  });

  it('returns empty when no test step exists', () => {
    const config = makeGitHubConfig([{ uses: 'actions/checkout@v4' }], 'setup');
    expect(findTestJobs(config, 'github')).toEqual([]);
  });

  it('returns empty for delegated workflow with no run steps', () => {
    const config = {
      jobs: {
        call: { uses: 'org/repo/.github/workflows/shared.yml@main' },
      },
    };
    expect(findTestJobs(config, 'github')).toEqual([]);
  });
});

describe('extractTestCommands GitHub', () => {
  it('extracts mvn test command', () => {
    const config = makeGitHubConfig([{ run: 'mvn test' }], 'java');
    expect(extractTestCommands(config, 'github', ['java'])).toEqual(['mvn test']);
  });

  it('extracts ./gradlew build command', () => {
    const config = makeGitHubConfig(
      [{ run: './gradlew -Pmockito.test.java=17 build --stacktrace --scan' }],
      'java',
    );
    expect(extractTestCommands(config, 'github', ['java'])).toEqual([
      './gradlew -Pmockito.test.java=17 build --stacktrace --scan',
    ]);
  });

  it('extracts ./gradlew test command', () => {
    const config = makeGitHubConfig([{ run: './gradlew test' }], 'jvm');
    expect(extractTestCommands(config, 'github', ['jvm'])).toEqual(['./gradlew test']);
  });

  it('returns empty for unknown job name', () => {
    const config = makeGitHubConfig([{ run: './gradlew test' }], 'jvm');
    expect(extractTestCommands(config, 'github', ['nonexistent'])).toEqual([]);
  });

  it('skips steps where run is not a string', () => {
    const config = makeGitHubConfig([{ run: ['mvn', 'test'] }, { run: 'mvn test' }], 'java');
    expect(extractTestCommands(config, 'github', ['java'])).toEqual(['mvn test']);
  });
});

describe('findTestJobs GitLab', () => {
  it('detects mvn test in script', () => {
    const config = { test: { script: ['mvn test'] } };
    expect(findTestJobs(config, 'gitlab')).toEqual(['test']);
  });

  it('detects ./gradlew build in script', () => {
    const config = { build: { script: ['./gradlew build'] } };
    expect(findTestJobs(config, 'gitlab')).toEqual(['build']);
  });

  it('ignores ./gradlew build -x test', () => {
    const config = { build: { script: ['./gradlew build -x test'] } };
    expect(findTestJobs(config, 'gitlab')).toEqual([]);
  });

  it('ignores jobs with no script', () => {
    const config = { deploy: { image: 'node:18' } };
    expect(findTestJobs(config, 'gitlab')).toEqual([]);
  });

  it('detects test line in scalar (non-array) script', () => {
    const config = { test: { script: 'mvn test' } };
    expect(findTestJobs(config, 'gitlab')).toEqual(['test']);
  });
});

describe('findTestJobs edge cases', () => {
  it('returns empty when config is null', () => {
    expect(findTestJobs(null, 'github')).toEqual([]);
    expect(findTestJobs(null, 'gitlab')).toEqual([]);
  });

  it('returns empty when config is falsy (undefined)', () => {
    expect(findTestJobs(undefined, 'github')).toEqual([]);
  });
});

describe('extractTestCommands GitLab', () => {
  it('extracts mvn test command from GitLab array script', () => {
    const config = { test: { script: ['echo setup', 'mvn test', 'echo done'] } };
    expect(extractTestCommands(config, 'gitlab', ['test'])).toEqual(['mvn test']);
  });

  it('extracts command from scalar (non-array) script', () => {
    const config = { test: { script: 'mvn test' } };
    expect(extractTestCommands(config, 'gitlab', ['test'])).toEqual(['mvn test']);
  });

  it('skips non-string lines in script array', () => {
    const config = { test: { script: [42, 'mvn test', null] } };
    expect(extractTestCommands(config, 'gitlab', ['test'])).toEqual(['mvn test']);
  });

  it('skips lines that are not test commands', () => {
    const config = { test: { script: ['echo build', 'docker build .', 'mvn test'] } };
    expect(extractTestCommands(config, 'gitlab', ['test'])).toEqual(['mvn test']);
  });

  it('skips jobs with no script', () => {
    const config = { deploy: { image: 'node:18' } };
    expect(extractTestCommands(config, 'gitlab', ['deploy'])).toEqual([]);
  });

  it('returns empty when config is null', () => {
    expect(extractTestCommands(null, 'gitlab', ['test'])).toEqual([]);
  });
});

describe('extractTestCommands edge cases', () => {
  it('returns empty when config is falsy (undefined)', () => {
    expect(extractTestCommands(undefined, 'github', ['build'])).toEqual([]);
  });
});

describe('findExistingCIFile', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-ci-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for github when .github/workflows directory does not exist', () => {
    expect(findExistingCIFile('github')).toBeNull();
  });

  it('returns null for github when no workflow file contains a test job', () => {
    const workflowsDir = path.join(tmpDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(path.join(workflowsDir, 'deploy.yml'), 'name: Deploy\non: [push]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo done\n', 'utf-8');
    expect(findExistingCIFile('github')).toBeNull();
  });

  it('returns path for github when a workflow file contains a test job', () => {
    const workflowsDir = path.join(tmpDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const content = 'name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: mvn test\n';
    fs.writeFileSync(path.join(workflowsDir, 'ci.yml'), content, 'utf-8');
    const result = findExistingCIFile('github');
    expect(result).not.toBeNull();
    expect(result).toContain('ci.yml');
  });
  it('detects .yaml extension workflow files', () => {
    const workflowsDir = path.join(tmpDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const content = `jobs:\n  build:\n    steps:\n      - run: mvn test\n`;
    fs.writeFileSync(path.join(workflowsDir, 'ci.yaml'), content, 'utf-8');
    const result = findExistingCIFile('github');
    expect(result).not.toBeNull();
    expect(result).toContain('ci.yaml');
  });
  it('returns null for gitlab when .gitlab-ci.yml does not exist', () => {
    expect(findExistingCIFile('gitlab')).toBeNull();
  });

  it('returns the gitlab path when .gitlab-ci.yml exists', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitlab-ci.yml'), 'test:\n  script: mvn test\n', 'utf-8');
    const result = findExistingCIFile('gitlab');
    expect(result).not.toBeNull();
    expect(result).toContain('.gitlab-ci.yml');
  });

  it('skips workflow files that contain invalid YAML', () => {
    const workflowsDir = path.join(tmpDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(path.join(workflowsDir, 'bad.yml'), ': invalid: [yaml: here', 'utf-8');
    expect(findExistingCIFile('github')).toBeNull();
  });

  it('returns null for an unsupported platform', () => {
    expect(findExistingCIFile('unknown' as any)).toBeNull();
  });
});
