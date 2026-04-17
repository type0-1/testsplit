import { WorkQueue, WorkerQueue } from '../../../../src/backend/runner/WorkQueue';
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

describe('WorkerQueue', () => {
  it('steal removes and returns the largest remaining task', () => {
    const q = new WorkerQueue([task('A', 1), task('B', 3), task('C', 2)]);
    expect(q.steal()?.id).toBe('B');
    expect(q.pop()?.id).toBe('C');
    expect(q.pop()?.id).toBe('A');
  });

  it('returns undefined from steal when empty', () => {
    const q = new WorkerQueue([]);
    expect(q.steal()).toBeUndefined();
  });

  it('computes totalWork from remaining tasks', () => {
    const q = new WorkerQueue([task('A', 1), task('B', 2), task('C', 3)]);
    expect(q.totalWork).toBe(6);
    q.pop();
    expect(q.totalWork).toBe(3);
  });

  it('isEmpty is true only when all tasks are consumed', () => {
    const q = new WorkerQueue([task('A', 1)]);
    expect(q.isEmpty).toBe(false);
    q.steal();
    expect(q.isEmpty).toBe(true);
  });
});
