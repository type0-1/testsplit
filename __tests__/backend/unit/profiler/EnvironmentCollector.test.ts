import fs from 'fs';
import { EnvironmentCollector } from '../../../../src/backend/profiler/core/EnvironmentCollector';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('EnvironmentCollector', () => {
  beforeEach(() => {
    mockFs.existsSync.mockReturnValue(false);
    delete process.env.CONTAINER_VERSION;
  });

  it('collects a valid cpu model string', () => {
    const metadata = EnvironmentCollector.collect();

    expect(typeof metadata.cpuModel).toBe('string');
    expect(metadata.cpuModel.length).toBeGreaterThan(0);
  });

  it('collects a positive cpu core count', () => {
    const metadata = EnvironmentCollector.collect();

    expect(typeof metadata.cpuCores).toBe('number');
    expect(metadata.cpuCores).toBeGreaterThan(0);
  });

  it('collects a valid platform string', () => {
    const metadata = EnvironmentCollector.collect();

    expect(typeof metadata.platform).toBe('string');
    expect(metadata.platform.length).toBeGreaterThan(0);
  });

  it('collects a valid node version', () => {
    const metadata = EnvironmentCollector.collect();

    expect(metadata.nodeVersion).toBe(process.version);
  });

  it('collects a valid os version string', () => {
    const metadata = EnvironmentCollector.collect();

    expect(typeof metadata.osVersion).toBe('string');
    expect(metadata.osVersion.length).toBeGreaterThan(0);
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

  it('sets generatedAt to a valid ISO timestamp', () => {
    const metadata = EnvironmentCollector.collect();

    expect(() => new Date(metadata.generatedAt!)).not.toThrow();
    expect(metadata.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});