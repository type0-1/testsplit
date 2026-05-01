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

    // jobs=2, runnerCores=2 -> first call uses 4 virtual slots (not persisted), second persists canonical jobCount
    expect(mockEngine.run).toHaveBeenNthCalledWith(
      1, expect.any(String), 4, false, expect.any(String), expect.any(Number), expect.any(Map),
    );
    expect(mockEngine.run).toHaveBeenNthCalledWith(
      2, expect.any(String), 2, true, expect.any(String), expect.any(Number), expect.any(Map),
    );
  });

  it('groups 4 slots into 2 runners (N×M -> N) in generated config', () => {
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

    // jobs=undefined -> jobCount=cpu count, runnerCores=3 -> totalSlots=cpu count * 3 (not persisted)
    // second call persists canonical jobCount distribution
    generateConfigHandler({ junit: '/test.xml', jobs: undefined, 'runner-cores': 3, platform: 'github', out: '/tmp/ci.yml', 'dry-run': false, algorithm: 'lpt', 'risk-factor': 1.0 });

    expect(mockEngine.run).toHaveBeenNthCalledWith(1, expect.any(String), mockOs.cpus().length * 3, false, expect.any(String), expect.any(Number), expect.any(Map));
    expect(mockEngine.run).toHaveBeenNthCalledWith(2, expect.any(String), mockOs.cpus().length, true, expect.any(String), expect.any(Number), expect.any(Map));
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
