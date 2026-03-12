import { MULTIFITScheduler } from '../../../../src/backend/algorithm/core/MULTIFITScheduler';
import { Task } from '../../../../src/backend/algorithm/model/Task';

describe('MULTIFITScheduler', () => {
  let scheduler: MULTIFITScheduler;

  beforeEach(() => {
    scheduler = new MULTIFITScheduler();
  });

  it('assigns all tasks exactly once', () => {
    const tasks: Task[] = [{ id: 'A', duration: 10 }, { id: 'B', duration: 5 }, { id: 'C', duration: 3 }];
    const result = scheduler.schedule(tasks, 2);
    const assignedIds = result.jobs.flatMap(j => j.tasks.map(t => t.id));

    expect(result.jobs.length).toBe(2);
    expect(new Set(assignedIds).size).toBe(3);
    expect(assignedIds).toHaveLength(3);
  });

  it('returns exactly jobCount jobs', () => {
    const tasks: Task[] = [{ id: 'A', duration: 10 }, { id: 'B', duration: 5 }];
    const result = scheduler.schedule(tasks, 4);

    expect(result.jobs.length).toBe(4);
  });

  it('pads with empty jobs when fewer tasks than jobs', () => {
    const tasks: Task[] = [{ id: 'A', duration: 5 }];
    const result = scheduler.schedule(tasks, 3);

    expect(result.jobs.length).toBe(3);
    const emptyJobs = result.jobs.filter(j => j.tasks.length === 0);
    expect(emptyJobs.length).toBe(2);
  });

  it('achieves perfect balance for uniform-duration tasks', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 5 }, { id: 'B', duration: 5 },
      { id: 'C', duration: 5 }, { id: 'D', duration: 5 },
    ];
    const result = scheduler.schedule(tasks, 2);

    expect(result.metrics.balanceRatio).toBe(1);
    expect(result.metrics.criticalPath).toBe(10);
  });

  it('places the dominant task alone when it exceeds average load', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 100 }, { id: 'B', duration: 1 }, { id: 'C', duration: 1 }, { id: 'D', duration: 1 },
    ];
    const result = scheduler.schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(100);
    expect(result.metrics.balanceRatio).toBeGreaterThan(1);
  });

  it('computes a makespan no greater than total duration', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 4 }, { id: 'B', duration: 3 }, { id: 'C', duration: 2 }, { id: 'D', duration: 1 },
    ];
    const result = scheduler.schedule(tasks, 2);
    const total = tasks.reduce((s, t) => s + t.duration, 0);

    expect(result.metrics.criticalPath).toBeLessThanOrEqual(total);
  });

  it('makespan is at least max(maxTask, totalDuration / jobs) - the theoretical lower bound', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 9 }, { id: 'B', duration: 8 }, { id: 'C', duration: 7 },
      { id: 'D', duration: 6 }, { id: 'E', duration: 5 },
    ];
    const result = scheduler.schedule(tasks, 3);
    const total = tasks.reduce((s, t) => s + t.duration, 0); // 35
    const lb = Math.max(9, total / 3); // 11.67

    expect(result.metrics.criticalPath).toBeGreaterThanOrEqual(lb);
  });

  it('respects the 1.22 * OPT approximation bound', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 9 }, { id: 'B', duration: 8 }, { id: 'C', duration: 7 },
      { id: 'D', duration: 6 }, { id: 'E', duration: 5 },
    ];
    const result = scheduler.schedule(tasks, 3);
    const total = tasks.reduce((s, t) => s + t.duration, 0); // 35
    const lb = Math.max(9, total / 3); // 11.67

    expect(result.metrics.criticalPath).toBeLessThanOrEqual(lb * 1.22 + 0.01); // +epsilon for float rounding
  });

  it('produces deterministic output for identical input', () => {
    const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 3 }, { id: 'C', duration: 1 }];
    const r1 = scheduler.schedule(tasks, 2);
    const r2 = scheduler.schedule(tasks, 2);

    expect(r1).toEqual(r2);
  });

  it('sets totalDuration and jobCount on the result', () => {
    const tasks: Task[] = [{ id: 'A', duration: 6 }, { id: 'B', duration: 4 }];
    const result = scheduler.schedule(tasks, 2);

    expect(result.totalDuration).toBe(10);
    expect(result.jobCount).toBe(2);
  });

  it('throws for an empty task list', () => {
    expect(() => scheduler.schedule([], 2)).toThrow();
  });

  it('throws for jobCount <= 0', () => {
    expect(() => scheduler.schedule([{ id: 'A', duration: 1 }], 0)).toThrow();
  });

  it('throws for a negative task duration', () => {
    expect(() => scheduler.schedule([{ id: 'A', duration: -1 }], 1)).toThrow();
  });

  it('throws for a non-finite task duration', () => {
    expect(() => scheduler.schedule([{ id: 'A', duration: Infinity }], 1)).toThrow();
  });
});
