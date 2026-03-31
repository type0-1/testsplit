import fs from 'fs';
import os from 'os';
import { EnvironmentCollector } from '../../../../src/backend/profiler/core/EnvironmentCollector';
import { CommitTracker } from '../../../../src/backend/helpers/CommitTracker';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('EnvironmentCollector', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    delete process.env.CONTAINER_VERSION;
  });

  it('uses provided commit when commit argument is passed', () => {
    const trackerSpy = jest.spyOn(CommitTracker, 'getCurrentCommit').mockReturnValue({
      sha: 'from-tracker',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const metadata = EnvironmentCollector.collect({
      sha: 'from-arg',
      timestamp: '2026-02-01T00:00:00.000Z',
    });

    expect(metadata.commit).toEqual({
      sha: 'from-arg',
      timestamp: '2026-02-01T00:00:00.000Z',
    });
    expect(trackerSpy).not.toHaveBeenCalled();
  });

  it('uses CommitTracker.getCurrentCommit when commit argument is not provided', () => {
    jest.spyOn(CommitTracker, 'getCurrentCommit').mockReturnValue({
      sha: 'abc123',
      timestamp: '2026-03-01T00:00:00.000Z',
    });

    const metadata = EnvironmentCollector.collect();

    expect(metadata.commit).toEqual({
      sha: 'abc123',
      timestamp: '2026-03-01T00:00:00.000Z',
    });
    expect(CommitTracker.getCurrentCommit).toHaveBeenCalledTimes(1);
  });

  it('populates generatedAt as an ISO timestamp string', () => {
    const metadata = EnvironmentCollector.collect();

    expect(metadata.generatedAt).not.toBeNull();
    expect(typeof metadata.generatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(metadata.generatedAt as string))).toBe(false);
    expect(metadata.generatedAt).toContain('T');
  });

  it('populates cpu and system fields from os/process', () => {
    jest.spyOn(os, 'cpus').mockReturnValue([
      {
        model: 'Test CPU',
        speed: 3200,
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
      },
      {
        model: 'Test CPU',
        speed: 3200,
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
      },
    ]);
    jest.spyOn(os, 'platform').mockReturnValue('linux');
    jest.spyOn(os, 'version').mockReturnValue('Linux test-kernel');

    const metadata = EnvironmentCollector.collect();

    expect(metadata.cpuModel).toBe('Test CPU');
    expect(metadata.cpuCores).toBe(2);
    expect(metadata.platform).toBe('linux');
    expect(metadata.osVersion).toBe('Linux test-kernel');
    expect(metadata.nodeVersion).toBe(process.version);
  });

  it('falls back to unknown cpu model and zero cores when cpus is empty', () => {
    jest.spyOn(os, 'cpus').mockReturnValue([]);

    const metadata = EnvironmentCollector.collect();

    expect(metadata.cpuModel).toBe('unknown');
    expect(metadata.cpuCores).toBe(0);
  });

  it('falls back to unknown osVersion when os.version is unavailable', () => {
    const originalVersionDescriptor = Object.getOwnPropertyDescriptor(os, 'version');

    Object.defineProperty(os, 'version', {
      value: undefined,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    try {
      const metadata = EnvironmentCollector.collect();
      expect(metadata.osVersion).toBe('unknown');
    } finally {
      if (originalVersionDescriptor) {
        Object.defineProperty(os, 'version', originalVersionDescriptor);
      }
    }
  });

  it('falls back to unknown platform when os.platform returns undefined', () => {
    jest.spyOn(os, 'platform').mockReturnValue(undefined as unknown as NodeJS.Platform);

    const metadata = EnvironmentCollector.collect();

    expect(metadata.platform).toBe('unknown');
  });

  it('falls back to unknown nodeVersion when process.version is undefined', () => {
    const originalVersionDescriptor = Object.getOwnPropertyDescriptor(process, 'version');

    Object.defineProperty(process, 'version', {
      value: undefined,
      writable: false,
      enumerable: true,
      configurable: true,
    });

    try {
      const metadata = EnvironmentCollector.collect();
      expect(metadata.nodeVersion).toBe('unknown');
    } finally {
      if (originalVersionDescriptor) {
        Object.defineProperty(process, 'version', originalVersionDescriptor);
      }
    }
  });

  it('sets containerVersion to none when not in docker', () => {
    mockFs.existsSync.mockReturnValue(false);

    const metadata = EnvironmentCollector.collect();

    expect(metadata.containerVersion).toBe('none');
  });

  it('sets containerVersion to docker when /.dockerenv exists', () => {
    mockFs.existsSync.mockReturnValue(true);

    const metadata = EnvironmentCollector.collect();

    expect(metadata.containerVersion).toBe('docker');
  });

  it('uses CONTAINER_VERSION env var when inside docker', () => {
    mockFs.existsSync.mockReturnValue(true);
    process.env.CONTAINER_VERSION = '2.0';

    const metadata = EnvironmentCollector.collect();

    expect(metadata.containerVersion).toBe('2.0');

    delete process.env.CONTAINER_VERSION;
  });

  it('sets containerVersion to none when fs.existsSync throws', () => {
    mockFs.existsSync.mockImplementation(() => {
      throw new Error('permission denied');
    });

    const metadata = EnvironmentCollector.collect();

    expect(metadata.containerVersion).toBe('none');
  });

});