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
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  cpus: jest.fn(() => jest.requireActual('os').cpus()),
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
import yargs from 'yargs';
import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import { FileStore } from '../../../../src/backend/storage/FileStore';

import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;
const MockTestSplitEngine = TestSplitEngine as jest.MockedClass<typeof TestSplitEngine>;
const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;

let profileHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  profileHandler = calls.find(c => c[0] === 'profile')?.[3];
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
