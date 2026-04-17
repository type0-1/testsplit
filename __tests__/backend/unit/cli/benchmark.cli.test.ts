jest.mock('yargs', () => {
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
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn((filePath: string, encoding?: string) => {
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
import yargs from 'yargs';
import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const MockTestSplitEngine = TestSplitEngine as jest.MockedClass<typeof TestSplitEngine>;

let benchmarkHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  benchmarkHandler = calls.find(c => c[0] === 'benchmark')?.[3];
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

describe('benchmark command handler', () => {
  let mockEngine: { run: jest.Mock };

  beforeEach(() => {
    jest.spyOn(process, 'exit').mockImplementation((code) => { throw new Error(`exit(${code})`); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockEngine = { run: jest.fn().mockReturnValue(mockEngineResult) };
    MockTestSplitEngine.mockImplementation(() => mockEngine as any);
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('is registered as a top-level command', () => {
    expect(typeof benchmarkHandler).toBe('function');
  });

  it('exits when junit path does not exist', () => {
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(false);
    expect(() => benchmarkHandler({ junit: '/bad.xml', jobs: 2 })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });

  it('exits when --jobs is not a positive integer', () => {
    expect(() => benchmarkHandler({ junit: '/test.xml', jobs: 0 })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--jobs'));
  });

  it('exits when no test cases were parsed', () => {
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      profile: { ...mockEngineResult.profile, testCount: 0, testResults: [] },
    });
    expect(() => benchmarkHandler({ junit: '/test.xml', jobs: 2 })).toThrow('exit(1)');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no test cases'));
  });

  it('prints Benchmark Report header', () => {
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Benchmark Report'));
  });

  it('prints sequential and parallel stages', () => {
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Sequential stage');
    expect(allCalls).toContain('Parallel stage');
  });

  it('prints delta report with speedup and time saved', () => {
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Delta report');
    expect(allCalls).toMatch(/Speedup:\s+\d+\.\d+x/);
    expect(allCalls).toContain('Time saved');
  });

  it('prints analysis time in ms', () => {
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toMatch(/Analysis time:\s+\d+(\.\d+)?ms/);
  });

  it('reports speedup as 1 when criticalPath is 0', () => {
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      distribution: { ...mockEngineResult.distribution, metrics: { ...mockEngineResult.distribution.metrics, criticalPath: 0 } },
    });
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Speedup: 1.00x');
  });

  it('reports timeSavedPct as 0 when totalDuration is 0', () => {
    mockEngine.run.mockReturnValue({
      ...mockEngineResult,
      profile: { ...mockEngineResult.profile, totalDuration: 0 },
      distribution: { ...mockEngineResult.distribution, metrics: { ...mockEngineResult.distribution.metrics, criticalPath: 0 } },
    });
    benchmarkHandler({ junit: '/test.xml', jobs: 2 });
    const allCalls = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(allCalls).toContain('Time saved:');
    expect(allCalls).toContain('(0.0%)');
  });
});