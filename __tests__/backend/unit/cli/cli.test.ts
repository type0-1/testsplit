jest.mock('yargs', () => { // Mock yargs to obtain command handlers (this is for direct testing)
  const chain: any = {};
  chain.command = jest.fn().mockReturnValue(chain);
  chain.demandCommand = jest.fn().mockReturnValue(chain);
  chain.help = jest.fn().mockReturnValue(chain);
  chain.version = jest.fn().mockReturnValue(chain);
  chain.alias = jest.fn().mockReturnValue(chain);
  chain.parse = jest.fn();
  return jest.fn(() => chain);
});
jest.mock('yargs/helpers', () => ({ hideBin: (a: string[]) => a.slice(2) }));
jest.mock('child_process', () => ({
  spawn: jest.fn(),
  execSync: jest.fn(),
}));

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  cpus: jest.fn(() => jest.requireActual('os').cpus()),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn((filePath: string, encoding?: string) => {
    // Allow reading package.json through to get the version
    if (filePath.includes('package.json')) {
      return jest.requireActual('fs').readFileSync(filePath, encoding);
    }
    return jest.fn()();
  }),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
}));

jest.mock('../../../../src/backend/core/TestSplitEngine');
jest.mock('../../../../src/backend/storage/FileStore');
jest.mock('../../../../src/backend/generator/GitHubActionsGenerator', () => ({
  ...jest.requireActual('../../../../src/backend/generator/GitHubActionsGenerator'),
  generateGitHubActionsConfig: jest.fn(),
}));
jest.mock('../../../../src/backend/generator/GitLabCIGenerator', () => ({
  ...jest.requireActual('../../../../src/backend/generator/GitLabCIGenerator'),
  generateGitLabCIConfig: jest.fn(),
}));
jest.mock('../../../../src/backend/generator/getSchemaValidator');
jest.mock('../../../../src/backend/generator/YAMLSyntaxValidator');
jest.mock('../../../../src/backend/runner/ParallelRunner');
jest.mock('../../../../src/backend/runner/CoreAffinity', () => ({
  getLeastLoadedCores: jest.fn(),
}));
jest.mock('../../../../src/backend/runner/TimingFeedback', () => ({
  persistObservedTimings: jest.fn(),
}));
jest.mock('../../../../src/backend/generator/ProjectInspection');
jest.mock('../../../../src/backend/core/DetectionOrchestrator');
jest.mock('../../../../src/backend/generator/DockerfileGenerator', () => ({
  generateDockerfile: jest.fn(() => 'generated-dockerfile'),
}));
jest.mock('../../../../src/backend/detector/PomParser', () => ({
  parsePom: jest.fn(() => ({})),
}));
jest.mock('yaml', () => ({ parse: jest.fn(), stringify: jest.fn(() => 'generated-yaml') }));
jest.mock('../../../../src/backend/api/server', () => ({
  buildApp: jest.fn(),
}));
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    red: (s: string) => s,
    yellow: (s: string) => s,
    green: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import yargs from 'yargs';
import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import {
  runAllJobs,
  runAllJobsDynamic,
  runAllJobsWorkStealing,
} from '../../../../src/backend/runner/ParallelRunner';
import { getLeastLoadedCores } from '../../../../src/backend/runner/CoreAffinity';
import { persistObservedTimings } from '../../../../src/backend/runner/TimingFeedback';
import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';
import { generateGitLabCIConfig } from '../../../../src/backend/generator/GitLabCIGenerator';
import { inspectProjectTestCommandFormat } from '../../../../src/backend/generator/ProjectInspection';
import { generateDockerfile } from '../../../../src/backend/generator/DockerfileGenerator';
import { parsePom } from '../../../../src/backend/detector/PomParser';
import { getSchemaValidator } from '../../../../src/backend/generator/getSchemaValidator';
import { validateYamlSyntax } from '../../../../src/backend/generator/YAMLSyntaxValidator';
import { runDetection } from '../../../../src/backend/core/DetectionOrchestrator';
import YAML from 'yaml';

import '../../../../src/backend/cli/cli';
import * as CIConfigReaderModule from '../../../../src/backend/cli/CIConfigReader';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const MockTestSplitEngine = TestSplitEngine as jest.MockedClass<typeof TestSplitEngine>;
const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;
const mockRunAllJobs = runAllJobs as jest.MockedFunction<typeof runAllJobs>;
const mockRunAllJobsDynamic = runAllJobsDynamic as jest.MockedFunction<typeof runAllJobsDynamic>;
const mockRunAllJobsWorkStealing = runAllJobsWorkStealing as jest.MockedFunction<typeof runAllJobsWorkStealing>;
const mockGetLeastLoadedCores = getLeastLoadedCores as jest.MockedFunction<typeof getLeastLoadedCores>;
const mockPersistObservedTimings = persistObservedTimings as jest.MockedFunction<typeof persistObservedTimings>;
const mockGenerateGitHubActionsConfig = generateGitHubActionsConfig as jest.MockedFunction<typeof generateGitHubActionsConfig>;
const mockGenerateGitLabCIConfig = generateGitLabCIConfig as jest.MockedFunction<typeof generateGitLabCIConfig>;
const mockInspectProjectTestCommandFormat = inspectProjectTestCommandFormat as jest.MockedFunction<typeof inspectProjectTestCommandFormat>;
const mockGenerateDockerfile = generateDockerfile as jest.MockedFunction<typeof generateDockerfile>;
const mockParsePom = parsePom as jest.MockedFunction<typeof parsePom>;
const mockGetSchemaValidator = getSchemaValidator as jest.MockedFunction<typeof getSchemaValidator>;
const mockValidateYamlSyntax = validateYamlSyntax as jest.MockedFunction<typeof validateYamlSyntax>;
const mockRunDetection = runDetection as jest.MockedFunction<typeof runDetection>;
const mockYAML = YAML as unknown as { parse: jest.Mock; stringify: jest.Mock };

let profileHandler: (argv: any) => void;
let generateConfigHandler: (argv: any) => void;
let validateHandler: (argv: any) => void;
let compareHandler: (argv: any) => void;
let benchmarkHandler: (argv: any) => void;
let runHandler: (argv: any) => Promise<void>;
let dashboardHandler: (argv: any) => Promise<void>;
let generateDockerfileHandler: (argv: any) => void;
let profileBuilder: (y: any) => any;
let compareBuilder: (y: any) => any;
let dashboardBuilder: (y: any) => any;
let generateBuilder: (y: any) => any;
let benchmarkBuilder: (y: any) => any;
let validateBuilder: (y: any) => any;
let runBuilder: (y: any) => any;
let generateDockerfileBuilder: (y: any) => any;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  profileBuilder = calls.find(c => c[0] === 'profile')?.[2];
  compareBuilder = calls.find(c => c[0] === 'compare')?.[2];
  dashboardBuilder = calls.find(c => c[0] === 'dashboard')?.[2];
  generateBuilder = calls.find((c) => {
    const commandName = c[0];
    if (Array.isArray(commandName)) {
      return commandName.includes('generate') || commandName.includes('generate-config');
    }
    return String(commandName).startsWith('generate');
  })?.[2];
  profileHandler = calls.find(c => c[0] === 'profile')?.[3];
  generateDockerfileBuilder = calls.find((c) => {
    const commandName = c[0];
    if (Array.isArray(commandName)) {
      return commandName.includes('dockerfile') || commandName.includes('generate-dockerfile');
    }
    return String(commandName) === 'dockerfile' || String(commandName) === 'generate-dockerfile';
  })?.[2];
  generateDockerfileHandler = calls.find((c) => {
    const commandName = c[0];
    if (Array.isArray(commandName)) {
      return commandName.includes('dockerfile') || commandName.includes('generate-dockerfile');
    }
    return String(commandName) === 'dockerfile' || String(commandName) === 'generate-dockerfile';
  })?.[3];
  generateConfigHandler = calls.find((c) => {
    const commandName = c[0];
    if (Array.isArray(commandName)) {
      return commandName.includes('generate') || commandName.includes('generate-config');
    }
    return String(commandName).startsWith('generate');
  })?.[3];
  validateBuilder = calls.find(c => c[0] === 'validate')?.[2];
  validateHandler = calls.find(c => c[0] === 'validate')?.[3];
  runBuilder = calls.find(c => c[0] === 'run')?.[2];
  compareHandler = calls.find(c => c[0] === 'compare')?.[3];
  benchmarkBuilder = calls.find(c => c[0] === 'benchmark')?.[2];
  benchmarkHandler = calls.find(c => c[0] === 'benchmark')?.[3];
  runHandler = calls.find(c => c[0] === 'run')?.[3];
  dashboardHandler = calls.find(c => c[0] === 'dashboard')?.[3];
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

describe('generate-config N×M scheduling', () => {
  let mockEngine: { run: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockEngine = { run: jest.fn().mockReturnValue({
      profile: { testCount: 4 },
      distribution: {
        jobCount: 4,
        jobs: [
          { totalTime: 1, tasks: [{ id: 'A', duration: 1 }] },
          { totalTime: 1, tasks: [{ id: 'B', duration: 1 }] },
          { totalTime: 1, tasks: [{ id: 'C', duration: 1 }] },
          { totalTime: 1, tasks: [{ id: 'D', duration: 1 }] },
        ],
        metrics: { criticalPath: 1, balanceRatio: 1 },
      },
    }) };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);
    mockFs.existsSync.mockReset();
    mockFs.statSync.mockReset();
    mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);
    mockRunDetection.mockReturnValue({
      containerImage: null,
      dependencyMap: new Map(),
      lifecycle: { hasDockerCompose: false, requirements: [] },
    } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('calls engine with jobCount * runnerCores virtual slots when runnerCores > 1', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };
    mockFs.existsSync
      .mockReturnValueOnce(true)  // workflows dir
      .mockReturnValueOnce(true)  // existingCIPath
      .mockReturnValueOnce(true)  // outDir
      .mockReturnValueOnce(false) // outPath not a dir
      .mockReturnValueOnce(true)  // junitPath
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);

    generateConfigHandler({
      junit: '/test.xml', jobs: 2, 'runner-cores': 2,
      platform: 'github', out: '/tmp/ci.yml', 'dry-run': false,
      algorithm: 'lpt', 'risk-factor': 1.0,
    });

    // jobs=2, runnerCores=2 → engine called with 4 virtual slots
    expect(mockEngine.run).toHaveBeenCalledWith(
      expect.any(String), 4, true, expect.any(String), expect.any(Number), expect.any(Map),
    );
  });

  it('groups 4 slots into 2 runners (N×M → N) in generated config', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };
    mockFs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);

    generateConfigHandler({
      junit: '/test.xml', jobs: 2, 'runner-cores': 2,
      platform: 'github', out: '/tmp/ci.yml', 'dry-run': false,
      algorithm: 'lpt', 'risk-factor': 1.0,
    });

    const config = (mockYAML.stringify as jest.Mock).mock.calls[0][0];
    // build + 2 test runners (not 4)
    expect(Object.keys(config.jobs)).toEqual(expect.arrayContaining(['build', 'test-job-1', 'test-job-2']));
    expect(Object.keys(config.jobs)).toHaveLength(3);
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
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('outputs profile and scheduling summary', () => {
    profileHandler({ junit: '/test.xml', jobs: 2, explain: false, algorithm: 'lpt', 'risk-factor': 1.0 });

    expect(mockEngine.run).toHaveBeenCalledWith(expect.any(String), 2, true, 'lpt', 1.0);
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

  it('caps --jobs to available cores and warns when requested jobs exceed cores', () => {
    mockOs.cpus.mockReturnValue([
      {} as os.CpuInfo,
      {} as os.CpuInfo,
    ]);

    profileHandler({
      junit: '/test.xml',
      jobs: 10,
      explain: false,
      algorithm: 'lpt',
      'risk-factor': 1.0,
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds available cores'),
    );
    expect(mockEngine.run).toHaveBeenCalledWith(
      expect.any(String),
      2,
      true,
      'lpt',
      1.0,
    );
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

  it('prints analysis time in profile summary (D1)', () => {
    profileHandler({ junit: '/test.xml', jobs: 2, explain: false });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toMatch(/Analysis time: \d+(\.\d+)?ms/);
  });

  it('prints vs ideal deviation for each job in job distribution (D3)', () => {
    profileHandler({ junit: '/test.xml', jobs: 2, explain: false });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('vs ideal');
  });

  it('prints uneven workload interpretation and truncates zero-duration list when more than five exist', () => {
    mockEngine.run.mockReturnValue({
      profile: {
        testCount: 9,
        totalDuration: 6,
        averageDuration: 0.67,
        testResults: [
          { name: 'LongTest', duration: 3, status: 'passed' },
          { name: 'MidTest', duration: 2, status: 'passed' },
          { name: 'ShortTest', duration: 1, status: 'passed' },
          { name: 'ZeroA', duration: 0, status: 'passed' },
          { name: 'ZeroB', duration: 0, status: 'passed' },
          { name: 'ZeroC', duration: 0, status: 'passed' },
          { name: 'ZeroD', duration: 0, status: 'passed' },
          { name: 'ZeroE', duration: 0, status: 'passed' },
          { name: 'ZeroF', duration: 0, status: 'passed' },
        ],
        metadata: { commit: null, generatedAt: null },
      },
      distribution: {
        jobCount: 2,
        jobs: [
          { totalTime: 5, tasks: [{ id: 'LongTest', duration: 3 }, { id: 'MidTest', duration: 2 }] },
          { totalTime: 1, tasks: [{ id: 'ShortTest', duration: 1 }] },
        ],
        metrics: { criticalPath: 5, balanceRatio: 2.5 },
      },
    });

    profileHandler({ junit: '/test.xml', jobs: 2, explain: true });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Workload is unevenly distributed across jobs.');
    expect(allCalls).toContain('...and 1 more');
  });

  it('uses dominant-test interpretation when one test exceeds 80% of total runtime', () => {
    mockEngine.run.mockReturnValue({
      profile: {
        testCount: 2,
        totalDuration: 10,
        averageDuration: 5,
        testResults: [
          { name: 'HugeTest', duration: 9, status: 'passed' },
          { name: 'TinyTest', duration: 1, status: 'passed' },
        ],
        metadata: { commit: null, generatedAt: null },
      },
      distribution: {
        jobCount: 2,
        jobs: [
          { totalTime: 9, tasks: [{ id: 'HugeTest', duration: 9 }] },
          { totalTime: 1, tasks: [{ id: 'TinyTest', duration: 1 }] },
        ],
        metrics: { criticalPath: 9, balanceRatio: 9 },
      },
    });

    profileHandler({ junit: '/test.xml', jobs: 2, explain: true });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Execution is dominated by a single long-running test');
  });

  it('handles empty testResults list by using null bottleneck and speedup fallback when criticalPath is zero', () => {
    mockEngine.run.mockReturnValue({
      profile: {
        testCount: 1,
        totalDuration: 0,
        averageDuration: 0,
        testResults: [],
        metadata: { commit: null, generatedAt: null },
      },
      distribution: {
        jobCount: 1,
        jobs: [
          { totalTime: 0, tasks: [] },
        ],
        metrics: { criticalPath: 0, balanceRatio: 1 },
      },
    });

    profileHandler({ junit: '/test.xml', jobs: 1, explain: true });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Predicted speed-up: 1.00×');
    expect(allCalls).not.toContain('Bottleneck test');
  });
});

describe('generate-config command handler', () => {
  let mockEngine: { run: jest.Mock };
  let mockStore: {
    loadLatestDistribution: jest.Mock;
    loadProfiles: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockEngine = { run: jest.fn().mockReturnValue(mockEngineResult) };
    mockStore = {
      loadLatestDistribution: jest.fn().mockReturnValue(mockEngineResult.distribution),
      loadProfiles: jest.fn().mockReturnValue([]),
    };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);
    MockFileStore.mockImplementation(() => mockStore as any);
    mockFs.existsSync.mockReset();
    mockFs.statSync.mockReset();
    mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);
    mockValidateYamlSyntax.mockImplementation(() => {});
    mockGetSchemaValidator.mockReturnValue({ validate: jest.fn() });
    mockInspectProjectTestCommandFormat.mockReturnValue({
      tool: 'maven',
      buildCommand: (tests: string[]) => `mvn test -Dtest=${tests.join(',')}`,
    });
    mockRunDetection.mockReturnValue({
      containerImage: null,
      dependencyMap: new Map(),
      lifecycle: { hasDockerCompose: false, requirements: [] },
    } as any);
    mockGenerateGitHubActionsConfig.mockReturnValue('github-yaml');
    mockGenerateGitLabCIConfig.mockReturnValue('gitlab-yaml');
  });

  afterEach(() => jest.restoreAllMocks());

  // existsSync call order: findExistingCIFile (1 call), existsSync(existingCIPath), outDir, outPath,
  // junitPath, Dockerfile (auto-docker), srcDir (auto-deps), suiteXMLPath (auto-deps).
  function setupExistsMocks() {
    const defaultConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(defaultConfig);
  }

  function setupExistsMocksWithCI(existingConfig: any) {
    mockFs.existsSync
      .mockReturnValueOnce(true)  // findExistingCIFile: workflows dir exists
      .mockReturnValueOnce(true)  // existsSync(existingCIPath)
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(false) // outPath not a directory
      .mockReturnValueOnce(true)  // junitPath exists
      .mockReturnValueOnce(false) // Dockerfile (skip auto-docker)
      .mockReturnValueOnce(false) // srcDir (skip auto-deps)
      .mockReturnValueOnce(false); // suiteXMLPath (skip auto-deps)
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);
  }

  it('generates split CI YAML from existing github config and writes to file', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    expect(mockYAML.stringify).toHaveBeenCalled();
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/tmp/ci.yml', expect.stringContaining('generated-yaml'), 'utf-8');
  });

  it('uses --template as the base config before auto-detection', () => {
    const templateConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };

    mockFs.existsSync.mockImplementation((filePath: any) => {
      const resolved = String(filePath);
      if (resolved === path.resolve('/tmp/template.yml')) return true;
      if (resolved === path.resolve('/tmp/ci.yml')) return false;
      if (resolved === path.dirname(path.resolve('/tmp/ci.yml'))) return true;
      if (resolved === path.resolve('/test.xml')) return true;
      return true;
    });
    mockFs.readFileSync.mockImplementation((filePath: any) => {
      if (String(filePath) === path.resolve('/tmp/template.yml')) {
        return 'template-yaml';
      }
      return 'raw-yaml';
    });
    mockYAML.parse.mockImplementation((raw: string) => {
      if (raw === 'template-yaml') return templateConfig;
      return templateConfig;
    });

    generateConfigHandler({
      junit: '/test.xml',
      jobs: 2,
      platform: 'github',
      out: '/tmp/ci.yml',
      template: '/tmp/template.yml',
      'dry-run': false,
    });

    expect(mockFs.readFileSync).toHaveBeenCalledWith(path.resolve('/tmp/template.yml'), 'utf-8');
    expect(mockYAML.stringify).toHaveBeenCalled();
  });

  it('passes needs when scheduled jobs have cross-job test dependencies', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      distribution: {
        ...mockEngineResult.distribution,
        jobs: [
          { totalTime: 2.0, tasks: [{ id: 'TestB', duration: 2.0, dependencies: ['TestA'] }] },
          { totalTime: 1.0, tasks: [{ id: 'TestA', duration: 1.0 }] },
        ],
      },
    });

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    expect(mockYAML.stringify).toHaveBeenCalled();
    const config = (mockYAML.stringify as jest.Mock).mock.calls[0][0];
    expect(config.jobs['test-job-1'].needs).toEqual(['build']);
  });

  it('writes gitlab config to stdout in dry-run mode', () => {
    const existingGitLabConfig = {
      stages: ['test'],
      test: { script: ['npm test'] },
    };
    mockFs.existsSync
      .mockReturnValueOnce(true)  // findExistingCIFile: .gitlab-ci.yml exists
      .mockReturnValueOnce(true)  // existsSync(existingCIPath)
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(false) // outPath not a directory
      .mockReturnValueOnce(true)  // junitPath exists
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingGitLabConfig);
    mockRunDetection.mockReturnValue({
      containerImage: null,
      dependencyMap: new Map(),
      lifecycle: {
        hasDockerCompose: false,
        requirements: [
          {
            type: 'redis',
            image: 'redis:7',
            source: 'testcontainers',
            ports: ['6379:6379'],
          },
        ],
      },
    } as any);

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'gitlab', out: '/tmp/ci.yml', 'dry-run': true });

    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('generated-yaml'));
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    const config = (mockYAML.stringify as jest.Mock).mock.calls.at(-1)?.[0];
    expect(Object.values(config).some((job: any) => Array.isArray(job?.services) && job.services.includes('redis:7'))).toBe(true);
  });

  it('injects split jobs into an existing github CI config', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };

    mockFs.existsSync
      .mockReturnValueOnce(true)  // workflows dir exists
      .mockReturnValueOnce(true)  // existsSync(existingCIPath)
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(false) // outPath not a dir
      .mockReturnValueOnce(true)  // junitPath exists
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);
    mockRunDetection.mockReturnValue({
      containerImage: null,
      dependencyMap: new Map(),
      lifecycle: {
        hasDockerCompose: false,
        requirements: [
          {
            type: 'postgres',
            image: 'postgres:15',
            source: 'spring',
            ports: ['5432:5432'],
            env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
          },
        ],
      },
    } as any);

    generateConfigHandler({
      junit: '/test.xml',
      jobs: 2,
      platform: 'github',
      out: path.resolve('.github/workflows/ci.yml'),
      'dry-run': false,
    });

    expect(mockYAML.stringify).toHaveBeenCalled();
    const config = (mockYAML.stringify as jest.Mock).mock.calls.at(-1)?.[0];
    expect(existingConfig.jobs).not.toHaveProperty('test');
    expect(Object.keys(existingConfig.jobs)).toEqual(expect.arrayContaining(['build', 'test-job-1', 'test-job-2']));
    expect(config.jobs.build.services).toMatchObject({
      postgres: {
        image: 'postgres:15',
        ports: ['5432:5432'],
        env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
      },
    });
    expect(config.jobs['test-job-1'].services).toMatchObject({
      postgres: {
        image: 'postgres:15',
        ports: ['5432:5432'],
        env: { POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' },
      },
    });
  });

  it('falls back to an empty jobs map when existing github jobs are cleared before merge', () => {
    const existingConfig: any = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };

    mockFs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingConfig);

    const ghModule = require('../../../../src/backend/generator/GitHubActionsGenerator') as any;
    const originalBuildGitHubPhasedJobs = ghModule.buildGitHubPhasedJobs;
    ghModule.buildGitHubPhasedJobs = (...args: any[]) => {
      existingConfig.jobs = undefined;
      return originalBuildGitHubPhasedJobs(...args);
    };

    try {
      generateConfigHandler({
        junit: '/test.xml',
        jobs: 2,
        platform: 'github',
        out: path.resolve('.github/workflows/ci.yml'),
        'dry-run': false,
      });

      const config = (mockYAML.stringify as jest.Mock).mock.calls.at(-1)?.[0];
      expect(config.jobs).not.toHaveProperty('test');
      expect(config.jobs).toHaveProperty('build');
      expect(config.jobs).toHaveProperty('test-job-1');
      expect(config.jobs).toHaveProperty('test-job-2');
    } finally {
      ghModule.buildGitHubPhasedJobs = originalBuildGitHubPhasedJobs;
    }
  });


  it('exits when output directory does not exist', () => {
    mockFs.existsSync
      .mockReturnValueOnce(true)   // existsSync(existingCIPath)
      .mockReturnValueOnce(false); // outDir missing

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/bad/ci.yml', 'dry-run': false, from: '/tmp/ci.yml' }),
    ).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('output directory'));
  });

  it('reports final schema validation issues before writing output', () => {
    setupExistsMocks();
    mockGetSchemaValidator.mockReturnValue({
      validate: () => {
        throw new Error('GitHub Actions schema violation: missing top-level "on"');
      },
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Final github CI config validation failed'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('schema violation'),
    );
  });

  it('reports final validation failure when YAML validator throws a non-Error value', () => {
    setupExistsMocks();
    mockValidateYamlSyntax.mockImplementation(() => {
      throw 123;
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('123'),
    );
  });

  it('reports final validation failure when schema validation throws a non-Error value', () => {
    setupExistsMocks();
    mockGetSchemaValidator.mockReturnValue({
      validate: () => {
        throw 'schema-broken';
      },
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('schema-broken'),
    );
  });

  it('reports final validation failure when schema validation throws a plain object', () => {
    setupExistsMocks();
    mockGetSchemaValidator.mockReturnValue({
      validate: () => {
        throw { reason: 'schema-broken' };
      },
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[object Object]'),
    );
  });

  it('logs dependency-cycle guidance when final config validation throws a dependency cycle error', () => {
    setupExistsMocks();
    mockValidateYamlSyntax.mockImplementation(() => {
      throw new Error('Dependency cycle detected in test ordering');
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('dependency cycle detected in test ordering'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Check @Order, @DependsOnMethods, or testng-suite.xml for circular dependencies.'),
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Use --src to point to a different source root, or remove the circular dependency.'),
    );
  });

  it('exits on inner error (e.g. no test jobs in existing CI config)', () => {
    mockFs.existsSync
      .mockReturnValueOnce(true)  // existsSync(fromPath)
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(false) // outPath not a dir
      .mockReturnValueOnce(true)  // junitPath exists
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue({ on: ['push'], jobs: { build: { steps: [{ run: 'npm build' }] } } });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: path.resolve('.github/workflows/ci.yml'), 'dry-run': false, from: '/tmp/ci.yml' }),
    ).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to generate'));
  });

  it('uses String(err) when outer catch receives a non-Error thrown value', () => {
    setupExistsMocks();
    mockFs.writeFileSync.mockImplementationOnce(() => {
      throw 'disk full';
    });

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to generate CI configuration'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('disk full'));
  });

  it('defaults --jobs to cpu count when --jobs is not specified', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);

    // jobs=undefined → jobCount=cpu count, runnerCores=3 → totalSlots=cpu count * 3
    generateConfigHandler({ junit: '/test.xml', jobs: undefined, 'runner-cores': 3, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false, algorithm: 'lpt', 'risk-factor': 1.0 });

    expect(mockEngine.run).toHaveBeenCalledWith(expect.any(String), mockOs.cpus().length * 3, true, expect.any(String), expect.any(Number), expect.any(Map));
  });

  it('exits when no CI config path is found and --from is not provided', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // findExistingCIFile: workflows dir missing (returns null)
      .mockReturnValueOnce(true); // outDir exists

    expect(() =>
      generateConfigHandler({
        junit: '/test.xml',
        jobs: 2,
        platform: 'github',
        out: '/tmp/ci.yml',
        'dry-run': false,
      }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No CI config found'),
    );
  });

  it('exits when resolved CI config file path does not exist', () => {
    mockFs.existsSync
      .mockReset()
      .mockReturnValueOnce(false); // existingCIPath does not exist

    expect(() =>
      generateConfigHandler({
        junit: '/test.xml',
        jobs: 2,
        platform: 'github',
        out: '/tmp/ci.yml',
        from: '/tmp/missing.yml',
        'dry-run': false,
      }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('CI config file does not exist'),
    );
  });

  it('exits when --out points to a directory path', () => {
    setupExistsMocks();
    mockFs.existsSync
      .mockReset()
      .mockReturnValueOnce(true)  // findExistingCIFile: workflows dir exists
      .mockReturnValueOnce(true)  // existsSync(existingCIPath)
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(true); // outPath exists
    mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

    expect(() =>
      generateConfigHandler({
        junit: '/test.xml',
        jobs: 2,
        platform: 'github',
        out: '/tmp',
        'dry-run': false,
      }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--out must be a file path, not a directory'),
    );
  });

  it('uses absolute --data path as-is when creating the engine', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);

    generateConfigHandler({
      junit: '/test.xml',
      jobs: 2,
      platform: 'github',
      out: '/tmp/ci.yml',
      data: '/abs/custom-data-dir',
      'dry-run': false,
    });

    expect(MockTestSplitEngine).toHaveBeenCalledWith('/abs/custom-data-dir');
  });

  it('logs detected container, dependencies, and service requirements', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);
    mockRunDetection.mockReturnValue({
      containerImage: 'eclipse-temurin:21-jdk',
      dependencyMap: new Map([['TestA', ['TestB']]]),
      lifecycle: {
        hasDockerCompose: false,
        requirements: [{ type: 'postgres' }, { type: 'redis' }],
      },
    } as any);

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).toContain('Dockerfile detected, using container: eclipse-temurin:21-jdk');
    expect(allLogs).toContain('Found 1 test(s) with declared dependencies');
    expect(allLogs).toContain('Detected services: postgres, redis');
  });

  it('logs docker-compose startup injection when lifecycle reports docker compose support', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ uses: 'actions/checkout@v4' }, { run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);
    mockRunDetection.mockReturnValue({
      containerImage: null,
      dependencyMap: new Map(),
      lifecycle: {
        hasDockerCompose: true,
        requirements: [],
      },
    } as any);

    generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false });

    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).toContain('docker-compose.yml detected startup steps will be injected');
  });

  it('uses fallback test command with custom maven-bin when extracted commands are empty for GitLab', () => {
    const existingGitLabConfig = {
      stages: ['test'],
      test: { script: ['npm test'] },
    };
    mockFs.existsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingGitLabConfig);

    const extractSpy = jest.spyOn(CIConfigReaderModule, 'extractTestCommands').mockReturnValue([]);

    generateConfigHandler({
      junit: '/test.xml',
      jobs: 2,
      platform: 'gitlab',
      out: '/tmp/ci.yml',
      'maven-bin': './mvnw',
      'dry-run': false,
    });

    const emittedConfig = (mockYAML.stringify as jest.Mock).mock.calls.at(-1)?.[0];
    expect(JSON.stringify(emittedConfig)).toContain('./mvnw test -Dtest=');
    extractSpy.mockRestore();
  });

  it('exits when github base job cannot be located for discovered test job name', () => {
    const existingConfig = {
      on: ['push'],
      jobs: { test: { steps: [{ run: 'npm test' }] } },
    };
    setupExistsMocksWithCI(existingConfig);

    const findSpy = jest.spyOn(CIConfigReaderModule, 'findTestJobs').mockReturnValue(['missing-job']);

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unable to locate base GitHub test job'));
    findSpy.mockRestore();
  });

  it('exits when gitlab base job cannot be located for discovered test job name', () => {
    const existingGitLabConfig = {
      stages: ['test'],
      test: { script: ['npm test'] },
    };
    mockFs.existsSync
      .mockReturnValueOnce(true)  // findExistingCIFile: .gitlab-ci.yml exists
      .mockReturnValueOnce(true)  // existingCIPath exists
      .mockReturnValueOnce(true)  // outDir exists
      .mockReturnValueOnce(false) // outPath not a directory
      .mockReturnValueOnce(true)  // junitPath exists
      .mockReturnValueOnce(false) // Dockerfile
      .mockReturnValueOnce(false) // srcDir
      .mockReturnValueOnce(false); // suiteXMLPath
    mockFs.readFileSync.mockReturnValue('raw-yaml');
    mockYAML.parse.mockReturnValue(existingGitLabConfig);

    const findSpy = jest.spyOn(CIConfigReaderModule, 'findTestJobs').mockReturnValue(['missing-job']);

    expect(() =>
      generateConfigHandler({ junit: '/test.xml', jobs: 2, platform: 'gitlab', out: '/tmp/ci.yml', 'dry-run': false }),
    ).toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unable to locate base GitLab test job'));
    findSpy.mockRestore();
  });
});

describe('compare command handler', () => {
  let mockStore: { loadHistoricalDeltas: jest.Mock };

  const deltaA = {
    createdAt: '2026-01-01T00:00:00.000Z',
    deltas: { runAt: '2026-01-01T00:00:00.000Z', commit: 'abc1234', testCount: 10, totalDuration: 100, averageDuration: 10, criticalPath: 50, balanceRatio: 1.0 },
  };
  const deltaB = {
    createdAt: '2026-01-02T00:00:00.000Z',
    deltas: { runAt: '2026-01-02T00:00:00.000Z', commit: 'def5678', testCount: 12, totalDuration: 90, averageDuration: 9, criticalPath: 45, balanceRatio: 1.04 },
  };
  const deltaRegressed = {
    createdAt: '2026-01-02T00:00:00.000Z',
    deltas: { runAt: '2026-01-02T00:00:00.000Z', commit: null, testCount: 10, totalDuration: 130, averageDuration: 13, criticalPath: 80, balanceRatio: 2.0 },
  };

  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockStore = { loadHistoricalDeltas: jest.fn() };
    MockFileStore.mockImplementation(() => mockStore as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('exits when no historical runs exist', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([]);
    expect(() => compareHandler({ runs: 2, data: '.data', threshold: 10 })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No historical runs found'));
  });

  it('exits when only one run exists', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([deltaA]);
    expect(() => compareHandler({ runs: 2, data: '.data', threshold: 10 })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('at least 2 runs'));
  });

  it('prints the delta table with Run A and Run B columns', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([deltaB, deltaA]); // newest first
    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Run A'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Run B'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Delta'));
  });

  it('prints metric rows in the table', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([deltaB, deltaA]);
    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Critical path');
    expect(allCalls).toContain('Balance ratio');
    expect(allCalls).toContain('Total duration');
  });

  it('shows no regressions when metrics improve', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([deltaB, deltaA]); // B is newer with lower criticalPath
    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No regressions detected'));
  });

  it('shows regression warning when critical path worsens beyond threshold', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([deltaRegressed, deltaA]); // newest first
    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('REGRESSION');
    expect(allCalls).toContain('Critical path');
  });

  it('prints a dash when the newer run has no commit hash', () => {
    mockStore.loadHistoricalDeltas.mockReturnValue([
      { ...deltaA, deltas: { ...deltaA.deltas, commit: null } },
      deltaB,
    ]);

    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    const commitLine = (console.log as jest.Mock).mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.startsWith('Commit'));
    expect(commitLine).toContain('-');
  });

  it('prints a dash when the older run (run A) has no commit hash', () => {
    // loadHistoricalDeltas returns newest-first; after .reverse(), last item becomes run A
    mockStore.loadHistoricalDeltas.mockReturnValue([
      deltaB,
      { ...deltaA, deltas: { ...deltaA.deltas, commit: null } },
    ]);

    compareHandler({ runs: 2, data: '.data', threshold: 10 });

    const commitLine = (console.log as jest.Mock).mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.startsWith('Commit'));
    expect(commitLine).toContain('-');
  });
});

describe('run command handler', () => {
  let mockEngine: { run: jest.Mock };

  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockEngine = { run: jest.fn().mockReturnValue(mockEngineResult) };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);

    mockRunAllJobs.mockResolvedValue([
      {
        jobId: 1,
        testNames: ['TestA'],
        wallClockMs: 100,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
    ] as any);
    mockRunAllJobsDynamic.mockResolvedValue([] as any);
    mockRunAllJobsWorkStealing.mockResolvedValue([] as any);
    mockGetLeastLoadedCores.mockResolvedValue([1, 2] as any);
    mockPersistObservedTimings.mockImplementation(() => {});

    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('profiles with persistence and executes jobs in one command', async () => {
    await runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: false,
      steal: false,
      affinity: false,
    });

    expect(MockTestSplitEngine).toHaveBeenCalledWith('.data');
    expect(mockEngine.run).toHaveBeenCalledWith(
      path.resolve('/test.xml'),
      2,
      true,
      'lpt',
      1.0,
    );
    expect(mockRunAllJobs).toHaveBeenCalled();
  });

  it('exits when junit path does not exist', async () => {
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(false);

    await expect(
      runHandler({
        junit: '/missing.xml',
        jobs: 2,
        data: '.data',
        cmd: 'npm test',
        'filter-flag': '--testNamePattern',
        'filter-join': '|',
        algorithm: 'lpt',
        'risk-factor': 1.0,
        dynamic: false,
        steal: false,
        affinity: false,
      }),
    ).rejects.toThrow('exit(1)');
  });

  it('exits when --risk-factor is invalid', async () => {
    await expect(
      runHandler({
        junit: '/test.xml',
        jobs: 2,
        data: '.data',
        cmd: 'npm test',
        'filter-flag': '--testNamePattern',
        'filter-join': '|',
        algorithm: 'lpt',
        'risk-factor': -1,
        dynamic: false,
        steal: false,
        affinity: false,
      }),
    ).rejects.toThrow('exit(1)');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--risk-factor'),
    );
  });

  it('warns when observed timings persistence fails', async () => {
    mockPersistObservedTimings.mockImplementation(() => {
      throw new Error('disk full');
    });

    await runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: false,
      steal: false,
      affinity: false,
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Warning: failed to persist observed timings'),
    );
  });

  it('logs core affinity and passes core IDs to the runner when affinity=true', async () => {
    mockGetLeastLoadedCores.mockResolvedValue([3, 7] as any);
    mockRunAllJobs.mockResolvedValue([
      {
        jobId: 1,
        testNames: ['TestA'],
        wallClockMs: 100,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
    ] as any);

    await runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: false,
      steal: false,
      affinity: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Core affinity: pinning workers to cores [3, 7]'),
    );
    expect(mockRunAllJobs).toHaveBeenCalledWith(
      expect.any(Array),
      'npm test',
      '--testNamePattern',
      '|',
      [3, 7],
    );
  });

  it('uses work-stealing runner when steal=true', async () => {
    mockRunAllJobs.mockClear();
    mockRunAllJobsDynamic.mockClear();
    mockRunAllJobsWorkStealing.mockClear();

    mockRunAllJobsWorkStealing.mockResolvedValue([
      {
        jobId: 1,
        testNames: ['TestA'],
        wallClockMs: 80,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
    ] as any);

    await runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: false,
      steal: true,
      affinity: false,
    });

    expect(mockRunAllJobsWorkStealing).toHaveBeenCalledWith(
      expect.any(Array),
      'npm test',
      '--testNamePattern',
    );
    expect(mockRunAllJobsDynamic).not.toHaveBeenCalled();
    expect(mockRunAllJobs).not.toHaveBeenCalled();
  });

  it('uses dynamic runner when dynamic=true and steal=false', async () => {
    mockRunAllJobs.mockClear();
    mockRunAllJobsDynamic.mockClear();
    mockRunAllJobsWorkStealing.mockClear();

    mockRunAllJobsDynamic.mockResolvedValue([
      {
        jobId: 1,
        testNames: ['TestA'],
        wallClockMs: 90,
        exitCode: 0,
        stdout: '',
        stderr: '',
      },
    ] as any);

    await runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: true,
      steal: false,
      affinity: false,
    });

    expect(mockRunAllJobsDynamic).toHaveBeenCalledWith(
      expect.any(Array),
      'npm test',
      '--testNamePattern',
    );
    expect(mockRunAllJobsWorkStealing).not.toHaveBeenCalled();
    expect(mockRunAllJobs).not.toHaveBeenCalled();
  });

  it('logs failed jobs and exits when any job has a non-zero exit code', async () => {
    mockRunAllJobs.mockResolvedValue([
      {
        jobId: 1,
        testNames: ['TestA', 'TestB'],
        wallClockMs: 123,
        exitCode: 1,
        stdout: '',
        stderr: 'boom',
      },
    ] as any);

    await expect(runHandler({
      junit: '/test.xml',
      jobs: 2,
      data: '.data',
      cmd: 'npm test',
      'filter-flag': '--testNamePattern',
      'filter-join': '|',
      algorithm: 'lpt',
      'risk-factor': 1.0,
      dynamic: false,
      steal: false,
      affinity: false,
    })).rejects.toThrow('exit(1)');

    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).toContain('Job 1  FAIL  123ms  (2 tests)');
    expect(process.exit).toHaveBeenCalledWith(1);
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

  it('exits when the validation file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    expect(() => validateHandler({ file: '/tmp/missing.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('file does not exist'),
    );
  });

  it('exits on invalid YAML syntax and prints the parser message when available', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockImplementation(() => {
      throw new Error('unexpected token');
    });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid YAML syntax'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unexpected token'));
  });

  it('exits on invalid YAML syntax and skips error message when thrown value is not an Error', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockImplementationOnce(() => { throw 'bad yaml'; });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Invalid YAML syntax'));
    const errorCalls = (console.error as jest.Mock).mock.calls.flat();
    expect(errorCalls.filter((m: string) => m !== undefined && String(m).includes('bad yaml'))).toHaveLength(0);
  });

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

  it('reports github validation issues for missing on, jobs, and steps', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ jobs: { 'job-1': { steps: [] }, 'job-2': {} } });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'github' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('Missing required field: on (trigger)');
    expect(allErrors).toContain('Job "job-1": missing steps');
    expect(allErrors).toContain('Job "job-2": missing steps');
  });

  it('reports gitlab validation issues for missing stages, jobs, and script entries', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ jobA: { script: [] }, jobB: {} });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('Missing required field: stages');
    expect(allErrors).toContain('Job "jobA": missing script');
    expect(allErrors).toContain('Job "jobB": missing script');
  });

  it('reports gitlab validation issue when no jobs are defined', () => {
    mockFs.readFileSync.mockReturnValue('raw');
    mockYAML.parse.mockReturnValue({ stages: ['test'] });

    expect(() => validateHandler({ file: '/tmp/ci.yml', platform: 'gitlab' })).toThrow('exit(1)');
    const allErrors = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(allErrors).toContain('No jobs defined');
  });
});

describe('generate-dockerfile command handler', () => {
  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes dockerfile without java version or mvnw logs when neither pom nor mvnw exist', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // mvnw does not exist
      .mockReturnValueOnce(false); // pom.xml does not exist
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: undefined, hasMavenWrapper: false });
    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).not.toContain('Java version');
    expect(allLogs).not.toContain('Using ./mvnw');
  });

  it('writes dockerfile without java version log when pom exists but has no javaVersion', () => {
    mockFs.existsSync
      .mockReturnValueOnce(false) // mvnw does not exist
      .mockReturnValueOnce(true);  // pom.xml exists
    mockParsePom.mockReturnValue({} as any); // no javaVersion property
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: undefined, hasMavenWrapper: false });
    const allLogs = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allLogs).not.toContain('Java version');
  });

  it('writes dockerfile and logs java version and maven wrapper when both are detected', () => {
    mockFs.existsSync
      .mockReturnValueOnce(true)  // mvnw exists
      .mockReturnValueOnce(true); // pom.xml exists
    mockParsePom.mockReturnValue({ javaVersion: '21' } as any);
    mockGenerateDockerfile.mockReturnValue('FROM eclipse-temurin:21-jdk');

    expect(() => generateDockerfileHandler({ pom: '/tmp/pom.xml', out: '/tmp/Dockerfile' })).not.toThrow();

    expect(mockGenerateDockerfile).toHaveBeenCalledWith({ javaVersion: '21', hasMavenWrapper: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith('/tmp/Dockerfile', 'FROM eclipse-temurin:21-jdk', 'utf-8');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dockerfile written to /tmp/Dockerfile'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Java version: 21'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Using ./mvnw'));
  });
});

describe('top-level help rendering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('prints custom top-level help and exits with code 0 when --help is provided', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'testsplit', '--help'];

    mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor, encoding?: any) => {
      const pathAsString = String(filePath);
      if (pathAsString.includes('package.json')) {
        return jest.requireActual('fs').readFileSync(filePath, encoding);
      }
      return '';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });

    expect(() => {
      jest.isolateModules(() => {
        // Re-import to run module-level --help interception branch.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../../../src/backend/cli/cli');
      });
    }).toThrow('exit(0)');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('testsplit'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('v'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('generate-config'));

    process.argv = originalArgv;
  });

  it('treats two-arg help form as top-level help (--help <arg>)', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'testsplit', '--help', 'profile'];

    mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor, encoding?: any) => {
      const pathAsString = String(filePath);
      if (pathAsString.includes('package.json')) {
        return jest.requireActual('fs').readFileSync(filePath, encoding);
      }
      return '';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../../../src/backend/cli/cli');
      });
    }).toThrow('exit(0)');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    process.argv = originalArgv;
  });

  it('prints top-level help and exits when -h is provided', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'testsplit', '-h'];

    mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor, encoding?: any) => {
      const pathAsString = String(filePath);
      if (pathAsString.includes('package.json')) {
        return jest.requireActual('fs').readFileSync(filePath, encoding);
      }
      return '';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../../../src/backend/cli/cli');
      });
    }).toThrow('exit(0)');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    process.argv = originalArgv;
  });

  it('treats two-arg help form as top-level help (-h <arg>)', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'testsplit', '-h', 'profile'];

    mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor, encoding?: any) => {
      const pathAsString = String(filePath);
      if (pathAsString.includes('package.json')) {
        return jest.requireActual('fs').readFileSync(filePath, encoding);
      }
      return '';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../../../src/backend/cli/cli');
      });
    }).toThrow('exit(0)');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    process.argv = originalArgv;
  });

  it('does not trigger top-level help exit for command-specific help (profile --help)', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'testsplit', 'profile', '--help'];

    mockFs.readFileSync.mockImplementation((filePath: fs.PathOrFileDescriptor, encoding?: any) => {
      const pathAsString = String(filePath);
      if (pathAsString.includes('package.json')) {
        return jest.requireActual('fs').readFileSync(filePath, encoding);
      }
      return '';
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../../../../src/backend/cli/cli');
      });
    }).not.toThrow();

    expect(exitSpy).not.toHaveBeenCalledWith(0);
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    process.argv = originalArgv;
  });
});

describe('command builder callbacks', () => {
  it('executes profile command builder and chains option declarations', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = profileBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'junit',
      expect.objectContaining({ type: 'string', demandOption: false }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'jobs',
      expect.objectContaining({ type: 'number' }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'risk-factor',
      expect.objectContaining({ type: 'number' }),
    );
  });

  it('executes compare command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = compareBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'runs',
      expect.objectContaining({ type: 'number', default: 2 }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'data',
      expect.objectContaining({ type: 'string', default: '.data' }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'threshold',
      expect.objectContaining({ type: 'number', default: 10 }),
    );
  });

  it('executes generate command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = generateBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'junit',
      expect.objectContaining({ type: 'string', demandOption: true }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'jobs',
      expect.objectContaining({ type: 'number', default: mockOs.cpus().length }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'runner-cores',
      expect.objectContaining({ type: 'number', default: 2 }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'platform',
      expect.objectContaining({ type: 'string', default: 'github' }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'dry-run',
      expect.objectContaining({ type: 'boolean', default: false }),
    );
  });

  it('executes generate-dockerfile command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = generateDockerfileBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith('pom', expect.objectContaining({ type: 'string', default: 'pom.xml' }));
    expect(y.option).toHaveBeenCalledWith('out', expect.objectContaining({ type: 'string', default: 'Dockerfile' }));
  });

  it('executes run command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = runBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith('junit', expect.objectContaining({ type: 'string', demandOption: true }));
    expect(y.option).toHaveBeenCalledWith('jobs', expect.objectContaining({ type: 'number', default: os.cpus().length }));
    expect(y.option).toHaveBeenCalledWith('data', expect.objectContaining({ type: 'string', default: '.data' }));
    expect(y.option).toHaveBeenCalledWith('cmd', expect.objectContaining({ type: 'string', demandOption: true }));
    expect(y.option).toHaveBeenCalledWith('filter-flag', expect.objectContaining({ type: 'string', default: '--testNamePattern' }));
    expect(y.option).toHaveBeenCalledWith('filter-join', expect.objectContaining({ type: 'string', default: '|' }));
    expect(y.option).toHaveBeenCalledWith('algorithm', expect.objectContaining({ type: 'string', default: 'lpt' }));
    expect(y.option).toHaveBeenCalledWith('risk-factor', expect.objectContaining({ type: 'number', default: 1.0 }));
    expect(y.option).toHaveBeenCalledWith('dynamic', expect.objectContaining({ type: 'boolean', default: false }));
    expect(y.option).toHaveBeenCalledWith('steal', expect.objectContaining({ type: 'boolean', default: false }));
    expect(y.option).toHaveBeenCalledWith('affinity', expect.objectContaining({ type: 'boolean', default: false }));
  });

  it('executes validate command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = validateBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'file',
      expect.objectContaining({ type: 'string', demandOption: true }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'platform',
      expect.objectContaining({ type: 'string', default: 'github' }),
    );
  });

  it('executes benchmark command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = benchmarkBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'junit',
      expect.objectContaining({ type: 'string', demandOption: true }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'jobs',
      expect.objectContaining({ type: 'number' }),
    );
  });

  it('executes dashboard command builder and chains expected options', () => {
    const y = {
      option: jest.fn().mockReturnThis(),
    };

    const returned = dashboardBuilder(y);

    expect(returned).toBe(y);
    expect(y.option).toHaveBeenCalledWith(
      'port',
      expect.objectContaining({ type: 'number', default: 3001 }),
    );
    expect(y.option).toHaveBeenCalledWith(
      'no-open',
      expect.objectContaining({ type: 'boolean', default: false }),
    );
  });
});

describe('dashboard command handler', () => {
  let mockBuildApp: jest.Mock;
  let mockLocalSpawn: jest.Mock;
  let mockLocalExecSync: jest.Mock;
  let mockApp: { listen: jest.Mock };

  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'on').mockImplementation();
    // Re-require each time so we get the current mock instances jest.resetModules() in an
    // earlier afterEach invalidates the registry, causing dynamic imports in the handler to
    // receive fresh jest.fn()s that are different from the file-scope mockSpawn/mockExecSync.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require('child_process') as { spawn: jest.Mock; execSync: jest.Mock };
    mockLocalSpawn = cp.spawn;
    mockLocalExecSync = cp.execSync;
    mockLocalSpawn.mockReset();
    mockLocalExecSync.mockReset();
    mockFs.existsSync.mockReset();
    mockApp = { listen: jest.fn().mockResolvedValue(undefined) };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockBuildApp = (require('../../../../src/backend/api/server') as { buildApp: jest.Mock }).buildApp;
    mockBuildApp.mockResolvedValue(mockApp as any);
  });

  afterEach(() => {
    mockBuildApp.mockReset();
    jest.restoreAllMocks();
  });

  it('skips build, starts server, logs URL, and spawns opener on darwin when dist exists', async () => {
    mockFs.existsSync.mockReturnValue(true);
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

    await dashboardHandler({ port: 3001, 'no-open': false });

    expect(mockLocalExecSync).not.toHaveBeenCalled();
    expect(mockApp.listen).toHaveBeenCalledWith({ port: 3001, host: '0.0.0.0' });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dashboard running at http://localhost:3001'));
    expect(mockLocalSpawn).toHaveBeenCalledWith('open', ['http://localhost:3001'], expect.objectContaining({ detached: true }));
  });

  it('runs frontend build when dist does not exist', async () => {
    mockFs.existsSync.mockReturnValue(false);

    await dashboardHandler({ port: 3001, 'no-open': true });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Building frontend...'));
    expect(mockLocalExecSync).toHaveBeenCalledWith('npm run build:frontend', { stdio: 'inherit' });
  });

  it('logs error and exits when frontend build throws', async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockLocalExecSync.mockImplementation(() => { throw new Error('build failed'); });

    await expect(dashboardHandler({ port: 3001, 'no-open': true })).rejects.toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Frontend build failed.'));
  });

  it('sets process.env.PORT to the port value', async () => {
    mockFs.existsSync.mockReturnValue(true);
    delete process.env.PORT;

    await dashboardHandler({ port: 4242, 'no-open': true });

    expect(process.env.PORT).toBe('4242');
  });

  it('registers a SIGINT handler', async () => {
    mockFs.existsSync.mockReturnValue(true);

    await dashboardHandler({ port: 3001, 'no-open': true });

    expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('SIGINT handler logs shutdown message and exits 0', async () => {
    mockFs.existsSync.mockReturnValue(true);
    let sigintHandler!: () => void;
    (process.on as jest.Mock).mockImplementation((event: string, handler: () => void) => {
      if (event === 'SIGINT') sigintHandler = handler;
    });

    await dashboardHandler({ port: 3001, 'no-open': true });
    expect(() => sigintHandler()).toThrow('exit(0)');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dashboard stopped.'));
  });

  it('exits with error message when port is already in use (EADDRINUSE)', async () => {
    mockFs.existsSync.mockReturnValue(true);
    const err = Object.assign(new Error('address in use'), { code: 'EADDRINUSE' });
    mockApp.listen.mockRejectedValue(err);

    await expect(dashboardHandler({ port: 3001, 'no-open': true })).rejects.toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Port 3001 is already in use'));
  });

  it('re-throws non-EADDRINUSE listen errors', async () => {
    mockFs.existsSync.mockReturnValue(true);
    const err = Object.assign(new Error('unknown'), { code: 'EACCES' });
    mockApp.listen.mockRejectedValue(err);

    await expect(dashboardHandler({ port: 3001, 'no-open': true })).rejects.toThrow('unknown');
  });

  it('does not spawn opener when no-open is true', async () => {
    mockFs.existsSync.mockReturnValue(true);

    await dashboardHandler({ port: 3001, 'no-open': true });

    expect(mockLocalSpawn).not.toHaveBeenCalled();
  });

  it('spawns start on win32', async () => {
    mockFs.existsSync.mockReturnValue(true);
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    await dashboardHandler({ port: 3001, 'no-open': false });

    expect(mockLocalSpawn).toHaveBeenCalledWith('start', expect.any(Array), expect.any(Object));
  });

  it('spawns xdg-open on linux', async () => {
    mockFs.existsSync.mockReturnValue(true);
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

    await dashboardHandler({ port: 3001, 'no-open': false });

    expect(mockLocalSpawn).toHaveBeenCalledWith('xdg-open', expect.any(Array), expect.any(Object));
  });
});
