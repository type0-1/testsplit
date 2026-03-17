import { WorkQueue } from '../../../../src/backend/runner/WorkQueue';
import { Task } from '../../../../src/backend/algorithm/model/Task';

const task = (id: string, duration: number): Task => ({ id, duration });

describe('WorkQueue', () => {
  it('sorts tasks by duration descending on construction', () => {
    const q = new WorkQueue([task('A', 1), task('B', 5), task('C', 3)]);
    expect(q.pull()?.id).toBe('B');
    expect(q.pull()?.id).toBe('C');
    expect(q.pull()?.id).toBe('A');
  });

  it('does not mutate the original array', () => {
    const tasks = [task('A', 1), task('B', 2)];
    new WorkQueue(tasks);
    expect(tasks[0].id).toBe('A');
  });

  it('returns undefined when empty', () => {
    const q = new WorkQueue([task('A', 1)]);
    q.pull();
    expect(q.pull()).toBeUndefined();
  });

  it('tracks remaining count correctly', () => {
    const q = new WorkQueue([task('A', 1), task('B', 2)]);
    expect(q.remaining).toBe(2);
    q.pull();
    expect(q.remaining).toBe(1);
    q.pull();
    expect(q.remaining).toBe(0);
  });

  it('isEmpty is true only when all tasks are pulled', () => {
    const q = new WorkQueue([task('A', 1)]);
    expect(q.isEmpty).toBe(false);
    q.pull();
    expect(q.isEmpty).toBe(true);
  });
});
