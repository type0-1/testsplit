jest.mock('systeminformation', () => ({
  __esModule: true,
  default: { currentLoad: jest.fn() },
  currentLoad: jest.fn(),
}), { virtual: true });

const mockPlatform = jest.fn();
jest.mock('os', () => ({ ...jest.requireActual('os'), platform: mockPlatform }));

import { getLeastLoadedCores, wrapWithAffinity } from '../../../../src/backend/runner/CoreAffinity';

const siMock = require('systeminformation') as {
  currentLoad?: jest.Mock;
  default?: { currentLoad?: jest.Mock };
};
const mockCurrentLoad = (siMock.currentLoad ?? siMock.default?.currentLoad) as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('getLeastLoadedCores', () => {
  it('returns N least-loaded core indices sorted by ascending load', async () => {
    mockCurrentLoad.mockResolvedValue({
      cpus: [{ load: 80 }, { load: 10 }, { load: 50 }, { load: 5 }],
    });

    const cores = await getLeastLoadedCores(2);
    expect(cores).toEqual([3, 1]); // cores with load 5 and 10
  });

  it('returns exactly count cores', async () => {
    mockCurrentLoad.mockResolvedValue({
      cpus: [{ load: 20 }, { load: 40 }, { load: 60 }, { load: 80 }],
    });

    const cores = await getLeastLoadedCores(3);
    expect(cores).toHaveLength(3);
  });

  it('falls back to 0..N-1 when systeminformation throws', async () => {
    mockCurrentLoad.mockRejectedValue(new Error('permission denied'));
    const cores = await getLeastLoadedCores(4);
    expect(cores).toEqual([0, 1, 2, 3]);
  });

  it('returns cores sorted by ascending load', async () => {
    mockCurrentLoad.mockResolvedValue({
      cpus: [{ load: 90 }, { load: 30 }, { load: 10 }, { load: 60 }],
    });

    const cores = await getLeastLoadedCores(4);
    expect(cores).toEqual([2, 1, 3, 0]); // loads 10, 30, 60 and 90
  });
});

describe('wrapWithAffinity', () => {
  it('prepends taskset on Linux', () => {
    mockPlatform.mockReturnValue('linux');
    expect(wrapWithAffinity('mvn test', 2)).toBe('taskset -c 2 mvn test');
  });

  it('returns cmd unchanged on macOS', () => {
    mockPlatform.mockReturnValue('darwin');
    expect(wrapWithAffinity('mvn test', 2)).toBe('mvn test');
  });

  it('returns cmd unchanged on Windows', () => {
    mockPlatform.mockReturnValue('win32');
    expect(wrapWithAffinity('mvn test', 0)).toBe('mvn test');
  });

  it('uses the correct core index in the taskset flag', () => {
    mockPlatform.mockReturnValue('linux');
    expect(wrapWithAffinity('echo', 5)).toBe('taskset -c 5 echo');
  });
});
