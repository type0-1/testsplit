import { Profiler } from '../../../../src/backend/profiler/core/Profiler';
import { TestResult } from '../../../../src/backend/models/TestResult';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
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

  it('preserves test results in the profile', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: 1, status: 'passed' },
    ];

    const profile = profiler.generateProfile(results);

    expect(profile.testResults).toEqual(results);
  });

  it('throws an error for negative durations', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: -1, status: 'passed' },
    ];

    expect(() => profiler.generateProfile(results)).toThrow();
  });

  it('throws an error for non-finite durations', () => {
    const results: TestResult[] = [
      { name: 'A.test1', duration: NaN, status: 'passed' },
    ];

    expect(() => profiler.generateProfile(results)).toThrow();
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
});
