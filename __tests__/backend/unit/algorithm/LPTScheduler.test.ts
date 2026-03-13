import { LPTScheduler } from '../../../../src/backend/algorithm/core/LPTScheduler'
import { Task } from '../../../../src/backend/algorithm/model/Task';

describe('LPTScheduler', () => {
  it('places the largest task first, minimising the critical path', () => {
    const tasks: Task[] = [{ id: 'A', duration: 10 }, { id: 'B', duration: 5 }, { id: 'C', duration: 5 }];
    const result = new LPTScheduler().schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(10);
  });

  it('handles a dominant outlier task without crashing', () => {
    const tasks: Task[] = [{ id: 'A', duration: 100 }, { id: 'B', duration: 1 }, { id: 'C', duration: 1 }, { id: 'D', duration: 1 }];
    const result = new LPTScheduler().schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(100);
    expect(result.metrics.balanceRatio).toBeGreaterThan(1);
  });

  it('throws for an empty task list', () => {
    expect(() => new LPTScheduler().schedule([], 2)).toThrow();
  });

  it('throws for a negative task duration', () => {
    expect(() => new LPTScheduler().schedule([{ id: 'A', duration: -1 }], 1)).toThrow();
  });

  it('respects dependency order while scheduling longest ready tasks first', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 4 },
      { id: 'B', duration: 9, dependencies: ['A'] },
      { id: 'C', duration: 7 },
      { id: 'D', duration: 3, dependencies: ['B'] },
    ];

    const result = new LPTScheduler().schedule(tasks, 1);
    expect(result.jobs[0].tasks.map((t) => t.id)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('throws when a task depends on an unknown task id', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 4, dependencies: ['Z'] },
      { id: 'B', duration: 5 },
    ];

    expect(() => new LPTScheduler().schedule(tasks, 2)).toThrow('depends on unknown task');
  });

  it('throws for cyclic dependencies', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 5, dependencies: ['B'] },
      { id: 'B', duration: 6, dependencies: ['A'] },
    ];

    expect(() => new LPTScheduler().schedule(tasks, 2)).toThrow('Dependency cycle detected');
  });
});
