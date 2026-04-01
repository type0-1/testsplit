type SIModuleFactory = () => unknown;

async function loadCoreAffinity(siFactory: SIModuleFactory, platformValue = 'linux') {
  jest.resetModules();

  jest.doMock('os', () => ({
    ...jest.requireActual('os'),
    platform: () => platformValue,
  }));

  jest.doMock('systeminformation', siFactory as any, { virtual: true });

  return import('../../../../src/backend/runner/CoreAffinity');
}

describe('getLeastLoadedCores', () => {
  it('uses top-level currentLoad export when available', async () => {
    const { getLeastLoadedCores } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: jest.fn().mockResolvedValue({
        cpus: [{ load: 70 }, { load: 10 }, { load: 40 }, { load: 5 }],
      }),
      default: { currentLoad: jest.fn() },
    }));

    const cores = await getLeastLoadedCores(2);
    expect(cores).toEqual([3, 1]);
  });

  it('uses default.currentLoad when top-level currentLoad is not a function', async () => {
    const { getLeastLoadedCores } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: 'not-a-function',
      default: {
        currentLoad: jest.fn().mockResolvedValue({
          cpus: [{ load: 30 }, { load: 50 }, { load: 20 }],
        }),
      },
    }));

    const cores = await getLeastLoadedCores(3);
    expect(cores).toEqual([2, 0, 1]);
  });

  it('falls back to sequential indices when no usable currentLoad export exists', async () => {
    const { getLeastLoadedCores } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: undefined,
      default: {},
    }));

    const cores = await getLeastLoadedCores(4);
    expect(cores).toEqual([0, 1, 2, 3]);
  });

  it('falls back when currentLoad execution throws', async () => {
    const { getLeastLoadedCores } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: jest.fn().mockRejectedValue(new Error('permission denied')),
    }));

    const cores = await getLeastLoadedCores(3);
    expect(cores).toEqual([0, 1, 2]);
  });

  it('falls back when importing systeminformation throws', async () => {
    const { getLeastLoadedCores } = await loadCoreAffinity(() => {
      throw new Error('module unavailable');
    });

    const cores = await getLeastLoadedCores(2);
    expect(cores).toEqual([0, 1]);
  });
});

describe('wrapWithAffinity', () => {
  it('prepends taskset on Linux', async () => {
    const { wrapWithAffinity } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: jest.fn(),
    }), 'linux');

    expect(wrapWithAffinity('mvn test', 2)).toBe('taskset -c 2 mvn test');
  });

  it('returns command unchanged on non-Linux platforms', async () => {
    const { wrapWithAffinity } = await loadCoreAffinity(() => ({
      __esModule: true,
      currentLoad: jest.fn(),
    }), 'darwin');

    expect(wrapWithAffinity('mvn test', 2)).toBe('mvn test');
  });
});
