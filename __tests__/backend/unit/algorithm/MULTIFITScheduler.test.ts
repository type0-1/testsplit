import { MULTIFITScheduler } from '../../../../src/backend/algorithm/core/MULTIFITScheduler';
import { Task } from '../../../../src/backend/algorithm/model/Task';

describe('MULTIFITScheduler', () => {
  it('places the dominant task alone when it exceeds average load', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 100 }, { id: 'B', duration: 1 }, { id: 'C', duration: 1 }, { id: 'D', duration: 1 },
    ];
    const result = new MULTIFITScheduler().schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(100);
    expect(result.metrics.balanceRatio).toBeGreaterThan(1);
  });

  it('respects the 1.22 * OPT approximation bound', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 9 }, { id: 'B', duration: 8 }, { id: 'C', duration: 7 },
      { id: 'D', duration: 6 }, { id: 'E', duration: 5 },
    ];
    const result = new MULTIFITScheduler().schedule(tasks, 3);
    const total = tasks.reduce((s, t) => s + t.duration, 0); // 35
    const lb = Math.max(9, total / 3);                       // 11.67

    expect(result.metrics.criticalPath).toBeLessThanOrEqual(lb * 1.22 + 0.01);
  });

  it('throws for an empty task list', () => {
    expect(() => new MULTIFITScheduler().schedule([], 2)).toThrow();
  });

  it('throws for jobCount <= 0', () => {
    expect(() => new MULTIFITScheduler().schedule([{ id: 'A', duration: 1 }], 0)).toThrow();
  });

  it('throws for a negative task duration', () => {
    expect(() => new MULTIFITScheduler().schedule([{ id: 'A', duration: -1 }], 1)).toThrow();
  });

  it('throws for a non-finite task duration', () => {
    expect(() => new MULTIFITScheduler().schedule([{ id: 'A', duration: Infinity }], 1)).toThrow();
  });
});
