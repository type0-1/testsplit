import { Task } from '../../../../src/backend/algorithm/model/Task';
import {
  toMavenClassName,
  buildJobsWithDependencies,
  groupSlotsIntoRunners,
} from '../../../../src/backend/generator/JobBuilder';

describe('toMavenClassName', () => {
  test('removes method segments from fully qualified test ids', () => {
    const testId = 'org.apache.commons.lang3.StringUtilsTest.testIsEmpty';

    expect(toMavenClassName(testId)).toBe('org.apache.commons.lang3.StringUtilsTest');
  });

  test('strips parameterized suffixes before resolving class name', () => {
    expect(toMavenClassName('com.example.MyTest.testA[1]')).toBe('com.example.MyTest');
    expect(toMavenClassName('com.example.MyTest.testB(param=value)')).toBe('com.example.MyTest');
  });

  test('returns the stripped id when no method segment index above 0 is detected', () => {
    expect(toMavenClassName('SingleTest')).toBe('SingleTest');
  });
});

describe('buildJobsWithDependencies', () => {
  const task = (id: string, dependencies?: string[]): Task => ({ id, duration: 1, dependencies });

  test('builds job ids/tests and sorted unique cross-job needs', () => {
    const distributionJobs = [
      { tasks: [task('A'), task('B', ['C', 'X'])] },
      { tasks: [task('C'), task('D', ['A'])] },
      { tasks: [task('E', ['D', 'C'])] },
    ];

    expect(buildJobsWithDependencies(distributionJobs)).toEqual([
      { id: 1, tests: ['A', 'B'], needs: [2] },
      { id: 2, tests: ['C', 'D'], needs: [1] },
      { id: 3, tests: ['E'], needs: [2] },
    ]);
  });

  test('omits needs when dependencies are only same-job or missing', () => {
    const distributionJobs = [
      { tasks: [task('A', ['B']), task('B')] },
      { tasks: [task('C', ['missing'])] },
    ];

    expect(buildJobsWithDependencies(distributionJobs)).toEqual([
      { id: 1, tests: ['A', 'B'] },
      { id: 2, tests: ['C'] },
    ]);
  });

  test('sorts and deduplicates cross-job dependencies while ignoring same-job and unknown deps', () => {
    const distributionJobs = [
      { tasks: [task('A'), task('B')] },
      { tasks: [task('C')] },
      {
        tasks: [
          task('D', ['C', 'A', 'C', 'D', 'missing']),
        ],
      },
    ];

    expect(buildJobsWithDependencies(distributionJobs)).toEqual([
      { id: 1, tests: ['A', 'B'] },
      { id: 2, tests: ['C'] },
      { id: 3, tests: ['D'], needs: [1, 2] },
    ]);
  });
});

describe('groupSlotsIntoRunners', () => {
  const slot = (...ids: string[]): { tasks: Task[] } => ({
    tasks: ids.map((id) => ({ id, duration: 1 })),
  });

  test('groups consecutive slots and preserves test order', () => {
    const slots = [slot('A1', 'A2'), slot('B1'), slot('C1')];

    expect(groupSlotsIntoRunners(slots, 2)).toEqual([
      { id: 1, tests: ['A1', 'A2', 'B1'] },
      { id: 2, tests: ['C1'] },
    ]);
  });

  test('treats non-positive runnerCores as 1', () => {
    const slots = [slot('A'), slot('B')];

    expect(groupSlotsIntoRunners(slots, 0)).toEqual([
      { id: 1, tests: ['A'] },
      { id: 2, tests: ['B'] },
    ]);
  });
});
