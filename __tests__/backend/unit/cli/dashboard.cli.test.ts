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

import '../../../../src/backend/cli/cli';

const mockFs = fs as jest.Mocked<typeof fs>;

let dashboardHandler: (argv: any) => Promise<void>;

beforeAll(() => {
  const yargsInstance = (yargs as jest.MockedFunction<typeof yargs>).mock.results[0]?.value;
  const calls: any[][] = yargsInstance.command.mock.calls;
  dashboardHandler = calls.find(c => c[0] === 'dashboard')?.[3];
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
