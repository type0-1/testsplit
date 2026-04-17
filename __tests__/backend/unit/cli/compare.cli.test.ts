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

import yargs from 'yargs';
import { FileStore } from '../../../../src/backend/storage/FileStore';

import '../../../../src/backend/cli/cli';

const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;

let compareHandler: (argv: any) => void;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  compareHandler = calls.find(c => c[0] === 'compare')?.[3];
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
