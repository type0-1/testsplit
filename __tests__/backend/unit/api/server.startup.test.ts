import { runCli, start } from '../../../../src/backend/api/server';

describe('API server entrypoint', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    process.env.PORT = originalPort;
    jest.restoreAllMocks();
  });

  it('starts app with parsed PORT and logs startup URL', async () => {
    process.env.PORT = '4321';
    const listen = jest.fn().mockResolvedValue(undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await start(async () => ({ listen } as any));

    expect(listen).toHaveBeenCalledWith({ port: 4321, host: '0.0.0.0' });
    expect(logSpy).toHaveBeenCalledWith('API server running on http://localhost:4321');
  });

  it('uses default port 3001 when PORT is undefined', async () => {
    delete process.env.PORT;
    const listen = jest.fn().mockResolvedValue(undefined);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await start(async () => ({ listen } as any));

    expect(listen).toHaveBeenCalledWith({ port: 3001, host: '0.0.0.0' });
    expect(logSpy).toHaveBeenCalledWith('API server running on http://localhost:3001');
  });

  it('uses buildApp by default when appBuilder is not provided', async () => {
    process.env.PORT = '0';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const app = await start();
    await app.close();

    expect(logSpy).toHaveBeenCalledWith('API server running on http://localhost:0');
  });

  it('calls appBuilder exactly once', async () => {
    const listen = jest.fn().mockResolvedValue(undefined);
    const appBuilder = jest.fn().mockResolvedValue({ listen } as any);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await start(appBuilder);

    expect(appBuilder).toHaveBeenCalledTimes(1);
  });

  it('propagates listen errors from start()', async () => {
    process.env.PORT = '3002';
    const listenErr = new Error('listen failed');
    const listen = jest.fn().mockRejectedValue(listenErr);
    const appBuilder = jest.fn().mockResolvedValue({ listen } as any);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(start(appBuilder)).rejects.toThrow('listen failed');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('does nothing when not main module', async () => {
    const starter = jest.fn().mockResolvedValue(undefined);

    runCli(false, starter);
    await Promise.resolve();

    expect(starter).not.toHaveBeenCalled();
  });

  it('starts when running as main module', async () => {
    const starter = jest.fn().mockResolvedValue(undefined);

    runCli(true, starter);
    await Promise.resolve();

    expect(starter).toHaveBeenCalledTimes(1);
  });

  it('logs error and exits with code 1 when startup fails', async () => {
    const err = new Error('boom');
    const starter = jest.fn().mockRejectedValue(err);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(
        ((_: string | number | null | undefined) => undefined) as unknown as (
          code?: string | number | null | undefined,
        ) => never,
      );

    runCli(true, starter);
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(err);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
