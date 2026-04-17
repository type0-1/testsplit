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
jest.mock('../../../../src/backend/runner/ParallelRunner');
jest.mock('../../../../src/backend/runner/CoreAffinity', () => ({
  getLeastLoadedCores: jest.fn(),
}));
jest.mock('../../../../src/backend/runner/TimingFeedback', () => ({
  persistObservedTimings: jest.fn(),
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

import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;
const MockTestSplitEngine = TestSplitEngine as jest.MockedClass<typeof TestSplitEngine>;
const mockRunAllJobs = runAllJobs as jest.MockedFunction<typeof runAllJobs>;
const mockRunAllJobsDynamic = runAllJobsDynamic as jest.MockedFunction<typeof runAllJobsDynamic>;
const mockRunAllJobsWorkStealing = runAllJobsWorkStealing as jest.MockedFunction<typeof runAllJobsWorkStealing>;
const mockGetLeastLoadedCores = getLeastLoadedCores as jest.MockedFunction<typeof getLeastLoadedCores>;
const mockPersistObservedTimings = persistObservedTimings as jest.MockedFunction<typeof persistObservedTimings>;

let runHandler: (argv: any) => Promise<void>;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  runHandler = calls.find(c => c[0] === 'run')?.[3];
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
  },
};

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
