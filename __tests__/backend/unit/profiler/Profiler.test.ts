import { Profiler } from '../../../../src/backend/profiler/core/Profiler';
import { TestResult } from '../../../../src/backend/models/TestResult';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CommitTracker } from '../../../../src/backend/helpers/CommitTracker';
import { PROFILE_SCHEMA_VERSION } from '../../../../src/backend/storage/SchemaVersions';
import * as ProfilerValidator from '../../../../src/backend/profiler/validation/ProfilerValidator';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
    jest.restoreAllMocks();
    delete process.env.CONTAINER_VERSION;
  });

  it('computes total and average duration correctly', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 2, status: 'passed' },
      { name: 'B.test2', duration: 4, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.totalDuration).toBe(6);
    expect(profile.averageDuration).toBe(3);
    expect(profile.testCount).toBe(2);
  });

  it('sets schemaVersion in generated profile', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 2, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
  });

  it('preserves test results in the profile', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 1, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.testResults).toEqual(results);
  });

  it('throws an error when no test results are provided', () => {
    expect(() => profiler.generateProfile([])).toThrow();
  });

  it('builds metadata groupings for package, class, and file path', () => {
    const results: TestResult[] = [
      {
        name: 'pkg.ClassA.test1',
        duration: 2,
        status: 'passed',
        packageName: 'pkg',
        className: 'pkg.ClassA',
        filePath: 'pkg/ClassA.java',
      },
      {
        name: 'pkg.ClassA.test2',
        duration: 3,
        status: 'passed',
        packageName: 'pkg',
        className: 'pkg.ClassA',
        filePath: 'pkg/ClassA.java',
      },
      {
        name: 'pkg.sub.ClassB.test1',
        duration: 5,
        status: 'passed',
        packageName: 'pkg.sub',
        className: 'pkg.sub.ClassB',
        filePath: 'pkg/sub/ClassB.java',
      },
    ];

    const profile = profiler.generateProfile(results);
    const groupings = profile.metadata.groupings;

    expect(groupings).toBeDefined();

    expect(groupings!.byPackage.pkg).toEqual({
      testCount: 2,
      totalDuration: 5,
    });
    expect(groupings!.byClassName['pkg.ClassA']).toEqual({
      testCount: 2,
      totalDuration: 5,
    });
    expect(groupings!.byFilePath['pkg/ClassA.java']).toEqual({
      testCount: 2,
      totalDuration: 5,
    });
    expect(groupings!.byPackage['pkg.sub']).toEqual({
      testCount: 1,
      totalDuration: 5,
    });
  });

  it('groups missing package/class/filePath under unknown', () => {
    const results: TestResult[] = [
      { name: 'TestA', duration: 2, status: 'passed' },
      { name: 'TestB', duration: 3, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);
    const groupings = profile.metadata.groupings!;

    expect(groupings.byPackage.unknown).toEqual({ testCount: 2, totalDuration: 5 });
    expect(groupings.byClassName.unknown).toEqual({ testCount: 2, totalDuration: 5 });
    expect(groupings.byFilePath.unknown).toEqual({ testCount: 2, totalDuration: 5 });
  });

  it('uses explicit commit argument instead of CommitTracker', () => {
    const commitSpy = jest.spyOn(CommitTracker, 'getCurrentCommit').mockReturnValue({
      sha: 'from-tracker',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const profile = profiler.generateProfile(
      [{ name: 'A.test1', duration: 2, status: 'passed' }],
      { sha: 'from-arg', timestamp: '2026-01-02T00:00:00.000Z' },
    );

    expect(profile.metadata.commit).toEqual({
      sha: 'from-arg',
      timestamp: '2026-01-02T00:00:00.000Z',
    });
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('computes averageDuration as 0 when results are empty and validation is bypassed', () => {
    jest.spyOn(ProfilerValidator, 'validateResults').mockImplementation(() => {});
    jest.spyOn(ProfilerValidator, 'flagZeroDurationTests').mockReturnValue([]);
    jest.spyOn(ProfilerValidator, 'detectOutlierTests').mockReturnValue([]);
    jest.spyOn(ProfilerValidator, 'validateCommitPresence').mockImplementation(() => {});

    const profile = profiler.generateProfile([]);

    expect(profile.testCount).toBe(0);
    expect(profile.totalDuration).toBe(0);
    expect(profile.averageDuration).toBe(0);
  });

  it('collects metadata from runtime environment', () => {
    jest.spyOn(CommitTracker, 'getCurrentCommit').mockReturnValue({
      sha: 'abc123',
      timestamp: '2026-01-03T00:00:00.000Z',
    });
    jest.spyOn(os, 'cpus').mockReturnValue([
      {
        model: 'Test CPU',
        speed: 2800,
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
      },
    ]);
    jest.spyOn(os, 'version').mockReturnValue('test-os-version');
    jest.spyOn(os, 'platform').mockReturnValue('linux');
    jest.spyOn(os, 'totalmem').mockReturnValue(8 * 1024 * 1024 * 1024);
    process.env.CONTAINER_VERSION = 'docker-26';

    const profile = profiler.generateProfile([
      { name: 'A.test1', duration: 2, status: 'passed' },
    ]);

    expect(profile.metadata.commit).toEqual({ sha: 'abc123', timestamp: '2026-01-03T00:00:00.000Z' });
    expect(profile.metadata.generatedAt).toEqual(expect.any(String));
    expect(profile.metadata.cpuModel).toBe('Test CPU');
    expect(profile.metadata.cpuCores).toBe(1);
    expect(profile.metadata.osVersion).toBe('test-os-version');
    expect(profile.metadata.platform).toBe('linux');
    expect(profile.metadata.nodeVersion).toBe(process.version);
    expect(profile.metadata.containerVersion).toBe('docker-26');
    expect(profile.metadata.memoryLimitMb).toBe(8192);
  });

  it('uses cpuModel fallback when os.cpus returns an empty array', () => {
    jest.spyOn(os, 'cpus').mockReturnValue([]);

    const profile = profiler.generateProfile([
      { name: 'A.test1', duration: 2, status: 'passed' },
    ]);

    expect(profile.metadata.cpuModel).toBe('unknown');
    expect(profile.metadata.cpuCores).toBe(0);
  });

  it('uses osVersion fallback when os.version is not a function', () => {
    const originalVersionDescriptor = Object.getOwnPropertyDescriptor(os, 'version');

    Object.defineProperty(os, 'version', {
      value: undefined,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    try {
      const profile = profiler.generateProfile([
        { name: 'A.test1', duration: 2, status: 'passed' },
      ]);

      expect(profile.metadata.osVersion).toBe('unknown');
    } finally {
      if (originalVersionDescriptor) {
        Object.defineProperty(os, 'version', originalVersionDescriptor);
      }
    }
  });

  it('warns inline for zero-duration tests up to limit without writing report file', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as unknown as string);

    const results: TestResult[] = [
      { name: 'Zero1', duration: 0, status: 'passed' },
      { name: 'Zero2', duration: 0, status: 'passed' },
      { name: 'Normal', duration: 2, status: 'passed' },
    ];

    profiler.generateProfile(results);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 test(s) reported zero duration'));
    expect(writeSpy).not.toHaveBeenCalledWith(expect.stringContaining('zero-duration.txt'), expect.any(String));
    expect(mkdirSpy).not.toHaveBeenCalledWith(expect.stringContaining(path.join('.data', 'reports')), expect.any(Object));
  });

  it('writes zero-duration report when count exceeds inline limit', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as unknown as string);

    const results: TestResult[] = Array.from({ length: 11 }, (_, i) => ({
      name: `Zero${i + 1}`,
      duration: 0,
      status: 'passed' as const,
    }));

    profiler.generateProfile(results);

    expect(mkdirSpy).toHaveBeenCalledWith(path.resolve('.data', 'reports'), { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(
      path.join(path.resolve('.data', 'reports'), 'zero-duration.txt'),
      expect.stringContaining('Zero1'),
    );
  });

  it('warns inline for outliers up to limit without writing report file', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    const results: TestResult[] = [
      { name: 'A', duration: 1, status: 'passed' },
      { name: 'B', duration: 1, status: 'passed' },
      { name: 'C', duration: 1, status: 'passed' },
      { name: 'D', duration: 1, status: 'passed' },
      { name: 'E', duration: 1, status: 'passed' },
      { name: 'F', duration: 1, status: 'passed' },
      { name: 'Slow', duration: 100, status: 'passed' },
    ];

    profiler.generateProfile(results);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('outlier durations within this run'));
    expect(writeSpy).not.toHaveBeenCalledWith(expect.stringContaining('outliers.txt'), expect.any(String));
  });

  it('writes outliers report when outlier count exceeds inline limit', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as unknown as string);
    jest.spyOn(ProfilerValidator, 'detectOutlierTests').mockReturnValue(
      Array.from({ length: 11 }, (_, i) => `Outlier${i + 1}`),
    );

    const results: TestResult[] = [
      ...Array.from({ length: 11 }, (_, i) => ({
        name: `Test${i + 1}`,
        duration: i + 1,
        status: 'passed' as const,
      })),
    ];

    profiler.generateProfile(results);

    expect(mkdirSpy).toHaveBeenCalledWith(path.resolve('.data', 'reports'), { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(
      path.join(path.resolve('.data', 'reports'), 'outliers.txt'),
      expect.stringContaining('Outlier1'),
    );
  });
});
