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
});
