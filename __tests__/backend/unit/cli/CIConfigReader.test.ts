import { findTestJobs, extractTestCommands } from '../../../../src/backend/cli/CIConfigReader';

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
});
