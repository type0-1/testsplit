import { LPTScheduler } from '../../../src/backend/algorithm/core/LPTScheduler'
import { Task } from '../../../src/backend/algorithm/model/Task';

describe('LPTScheduler', () => {
  it('assigns tasks using longest processing time first', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: 10 }, { id: 'B', duration: 5 }, { id: 'C', duration: 5 }];
    const result = scheduler.schedule(tasks, 2);
    const assignedIds = result.jobs.flatMap(job => job.tasks.map(task => task.id)); // Assign each task to a job once.

    expect(result.jobs.length).toBe(2);
    expect(new Set(assignedIds).size).toBe(3);
    expect(result.metrics.criticalPath).toBe(10); // Critical path should be the longest job.
  });

  it('handles a task with an associated duration being an outlier', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: 100 }, { id: 'B', duration: 1 }, { id: 'C', duration: 1 }, { id: 'D', duration: 1 }];
    const result = scheduler.schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(100);
    expect(result.metrics.balanceRatio).toBeGreaterThan(1);
  });

  it('produces balance for identical durations', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 5 }, { id: 'C', duration: 5 }, { id: 'D', duration: 5 }];
    const result = scheduler.schedule(tasks, 2);

    expect(result.metrics.balanceRatio).toBe(1);
  });

  it('allows more jobs than tasks', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: 5 }];
    const result = scheduler.schedule(tasks, 3);

    expect(result.jobs.length).toBe(3);
  });

  it('throws an error for empty task list', () => {
    const scheduler = new LPTScheduler();
    expect(() => {
      scheduler.schedule([], 2);
    }).toThrow();
  });

  it('throws an error for negative task duration', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: -1 }];

    expect(() => {
      scheduler.schedule(tasks, 1);
    }).toThrow();
  });

  it('produces deterministic output for identical input', () => {
    const scheduler = new LPTScheduler();
    const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 3 }, { id: 'C', duration: 1 }];
    const r1 = scheduler.schedule(tasks, 2);
    const r2 = scheduler.schedule(tasks, 2);

    expect(r1).toEqual(r2);
  });
});
