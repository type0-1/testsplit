jest.mock('yargs', () => { // Mock yargs to obtain command handlers (this is for direct testing)
  const chain: any = {};
  chain.command = jest.fn().mockReturnValue(chain);
  chain.demandCommand = jest.fn().mockReturnValue(chain);
  chain.help = jest.fn().mockReturnValue(chain);
  chain.parse = jest.fn();
  return jest.fn(() => chain);
});
jest.mock('yargs/helpers', () => ({ hideBin: (a: string[]) => a.slice(2) }));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock('../../../../src/backend/core/TestSplitEngine');
jest.mock('../../../../src/backend/storage/FileStore');
jest.mock('../../../../src/backend/generator/GitHubActionsGenerator');
jest.mock('../../../../src/backend/generator/GitLabCIGenerator');
jest.mock('yaml', () => ({ parse: jest.fn(), stringify: jest.fn(() => 'generated-yaml') }));

import * as fs from 'fs';
import yargs from 'yargs';
import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';
import { generateGitLabCIConfig } from '../../../../src/backend/generator/GitLabCIGenerator';
import YAML from 'yaml';

import {
  findExistingCIFile,
  findTestJobs,
  extractTestCommands,
  buildGitHubSplitJobs,
  buildGitLabSplitJobs,
} from '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const MockTestSplitEngine = TestSplitEngine as jest.MockedClass<typeof TestSplitEngine>;
const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;
const mockGenerateGitHubActionsConfig = generateGitHubActionsConfig as jest.MockedFunction<typeof generateGitHubActionsConfig>;
const mockGenerateGitLabCIConfig = generateGitLabCIConfig as jest.MockedFunction<typeof generateGitLabCIConfig>;
const mockYAML = YAML as unknown as { parse: jest.Mock; stringify: jest.Mock };

let profileHandler: (argv: any) => void;
let generateConfigHandler: (argv: any) => void;
let validateHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  profileHandler = calls.find(c => c[0] === 'profile')?.[3];
  generateConfigHandler = calls.find(c => c[0] === 'generate-config')?.[3];
  validateHandler = calls.find(c => c[0] === 'validate')?.[3];
});

const mockEngineResult = {
  profile: {
    testCount: 2,
    totalDuration: 3.0,
    averageDuration: 1.5,
    testResults: [
      { name: 'TestA', duration: 1.0, status: 'passed' },
      { name: 'TestB', duration: 2.0, status: 'passed' },
    ],
    metadata: { commit: null, generatedAt: null },
  },
  distribution: {
    jobCount: 2,
    jobs: [
      { totalTime: 2.0, tasks: [{ id: 'TestB', duration: 2.0 }] },
      { totalTime: 1.0, tasks: [{ id: 'TestA', duration: 1.0 }] },
    ],
    metrics: { criticalPath: 2.0, balanceRatio: 1.5 },
  },
};

// Sanity check that functions are called in expected order w/ expected data.
describe('findExistingCIFile', () => {
  beforeEach(() => { mockFs.existsSync.mockReset(); mockFs.readdirSync.mockReset(); });

  it('returns null when .github/workflows does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(findExistingCIFile('github')).toBeNull();
  });

  it('returns path when workflows dir contains a yml file', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    expect(findExistingCIFile('github')).toContain('ci.yml');
  });

  it('returns null when workflows dir has no yml files', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readdirSync.mockReturnValue(['README.md'] as any);
    expect(findExistingCIFile('github')).toBeNull();
  });

  it('returns path when .gitlab-ci.yml exists', () => {
    mockFs.existsSync.mockReturnValue(true);
    expect(findExistingCIFile('gitlab')).toContain('.gitlab-ci.yml');
  });

  it('returns null when .gitlab-ci.yml does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(findExistingCIFile('gitlab')).toBeNull();
  });
});

describe('findTestJobs', () => {
  it('finds github jobs that have a test step', () => {
    const config = {
      jobs: {
        build: { steps: [{ run: 'npm build' }] },
        test:  { steps: [{ run: 'npm test' }] },
      },
    };
    expect(findTestJobs(config, 'github')).toEqual(['test']);
  });

  it('finds gitlab jobs that have a test script line', () => {
    const config = {
      test: { script: ['mvn test'] },
      lint: { script: ['npm run lint'] },
    };
    expect(findTestJobs(config, 'gitlab')).toEqual(['test']);
  });

  it('handles gitlab jobs where script is a plain string', () => {
    expect(findTestJobs({ test: { script: 'npm test' } }, 'gitlab')).toEqual(['test']);
  });
});

describe('extractTestCommands', () => {
  it('extracts test step commands for github', () => {
    const config = { jobs: { test: { steps: [{ run: 'npm build' }, { run: 'npm test' }] } } };
    expect(extractTestCommands(config, 'github', ['test'])).toEqual(['npm test']);
  });

  it('extracts test script lines for gitlab', () => {
    const config = { test: { script: ['npm install', 'npm test'] } };
    expect(extractTestCommands(config, 'gitlab', ['test'])).toEqual(['npm test']);
  });
});

describe('buildGitHubSplitJobs', () => {
  it('creates split jobs replacing only the test step', () => {
    const baseJob = { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] };
    const result = buildGitHubSplitJobs(baseJob, [{ id: 1, tests: ['A', 'B'] }, { id: 2, tests: ['C'] }], 'npm test');

    expect(result['job-1'].steps[1].run).toBe('npm test A B');
    expect(result['job-2'].steps[1].run).toBe('npm test C');
    expect(result['job-1'].steps[0]).toEqual({ uses: 'actions/checkout@v4' });
  });
});

describe('buildGitLabSplitJobs', () => {
  it('creates split jobs replacing the test line (array script)', () => {
    const result = buildGitLabSplitJobs(
      { script: ['npm install', 'npm test'] },
      [{ id: 1, tests: ['A'] }],
      'npm test',
    );
    expect(result['job-1'].script).toEqual(['npm install', 'npm test A']);
  });

  it('wraps a string script into an array before replacing', () => {
    const result = buildGitLabSplitJobs(
      { script: 'npm test' },
      [{ id: 1, tests: ['A'] }],
      'npm test',
    );
    expect(result['job-1'].script).toEqual(['npm test A']);
  });
});

// Command handler tests (cover cli logic w/ mocked engine + file store)
describe('profile command handler', () => {
  let mockEngine: { run: jest.Mock };
  let mockStore: { saveHistoricalDeltas: jest.Mock };

  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockStore = { saveHistoricalDeltas: jest.fn() };
    mockEngine = { run: jest.fn().mockReturnValue(mockEngineResult) };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);
    MockFileStore.mockImplementation(() => mockStore as any);
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('outputs profile and scheduling summary', () => {
    profileHandler({ junit: '/test.xml', jobs: 2, explain: false });

    expect(mockEngine.run).toHaveBeenCalledWith(expect.any(String), 2, true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Profile Summary'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Scheduling metrics'));
  });

  it('displays zero-duration test section when tests report 0s', () => {
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      profile: {
        ...mockEngineResult.profile,
        testResults: [
          { name: 'TestA', duration: 0, status: 'passed' },
          { name: 'TestB', duration: 2.0, status: 'passed' },
        ],
      },
    });
    profileHandler({ junit: '/test.xml', jobs: 2, explain: false });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Zero-duration tests'));
  });

  it('displays interpretation section when explain=true', () => {
    profileHandler({ junit: '/test.xml', jobs: 2, explain: true });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Interpretation'));
  });

  it('warns when delta persistence fails but does not exit', () => {
    mockStore.saveHistoricalDeltas.mockImplementation(() => { throw new Error('disk full'); });
    expect(() => profileHandler({ junit: '/test.xml', jobs: 2, explain: false })).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it('exits when --jobs is not a positive integer', () => {
    expect(() => profileHandler({ junit: '/test.xml', jobs: -1, explain: false })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--jobs'));
  });

  it('exits when junit path does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(() => profileHandler({ junit: '/bad.xml', jobs: 2, explain: false })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });

  it('exits when no test cases were parsed (testCount=0)', () => {
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      profile: { ...mockEngineResult.profile, testCount: 0, testResults: [] },
    });
    expect(() => profileHandler({ junit: '/test.xml', jobs: 2, explain: false })).toThrow('exit(1)');
  });
});

describe('generate-config command handler', () => {
  let mockEngine: { run: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockEngine = { run: jest.fn().mockReturnValue(mockEngineResult) };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);
    mockGenerateGitHubActionsConfig.mockReturnValue('github-yaml');
    mockGenerateGitLabCIConfig.mockReturnValue('gitlab-yaml');
  });

  afterEach(() => jest.restoreAllMocks());

  // existsSync call order: findExistingCIFile (1 call), outDir, outPath, junitPath.
  function setupExistsMocks() {
    mockFs.existsSync
      .mockReturnValueOnce(false) // findExistingCIFile: no existing CI file
      .mockReturnValueOnce(true) // outDir exists
      .mockReturnValueOnce(false) // outPath not a directory
      .mockReturnValueOnce(true); // junitPath exists
  }

  it('generates github config and writes to file', () => {
    setupExistsMocks();
    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    expect(mockGenerateGitHubActionsConfig).toHaveBeenCalledWith([
      { id: 1, tests: ['TestB'] },
      { id: 2, tests: ['TestA'] },
    ]);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/tmp/ci.yml', 'github-yaml', 'utf-8');
  });

  it('writes gitlab config to stdout in dry-run mode', () => {
    setupExistsMocks();
    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'gitlab', out: '/tmp/ci.yml', 'dry-run': true });

    expect(mockGenerateGitLabCIConfig).toHaveBeenCalled();
    expect(process.stdout.write).toHaveBeenCalledWith('gitlab-yaml');
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('injects split jobs into an existing github CI config', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };

    mockFs.existsSync
      .mockReturnValueOnce(true) // workflows dir exists
      .mockReturnValueOnce(true) // outDir exists
      .mockReturnValueOnce(false) // outPath not a dir
      .mockReturnValueOnce(true); // junitPath exists
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    expect(mockYAML.stringify).toHaveBeenCalled();
    expect(existingConfig.jobs).not.toHaveProperty('test');
    expect(Object.keys(existingConfig.jobs)).toEqual(expect.arrayContaining(['job-1', 'job-2']));
  });

  it('exits when output directory does not exist', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // no existing CI
      .mockReturnValueOnce(false); // outDir missing

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/bad/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('output directory'));
  });

  it('exits on inner error (e.g. no test jobs in existing CI config)', () => {
    mockFs.existsSync
      .mockReturnValueOnce(true) // workflows dir exists
      .mockReturnValueOnce(true) // outDir exists
      .mockReturnValueOnce(false) // outPath not a dir
      .mockReturnValueOnce(true); // junitPath exists
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue({ on: ['push'], jobs: { build: { steps: [{ run: 'npm build' }] } } });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to generate'));
  });
});

describe('validate command handler', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes a valid github actions config', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ on: ['push'], jobs: { 'job-1': { steps: [{ run: 'npm test' }] } } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).not.toThrow();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });

  it('exits when github config has validation issues', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ name: 'CI' }); // missing 'on' and 'jobs'

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
  });

  it('passes a valid gitlab ci config', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ stages: ['test'], 'job-1': { script: ['npm test'] } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).not.toThrow();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('valid'));
  });
});
