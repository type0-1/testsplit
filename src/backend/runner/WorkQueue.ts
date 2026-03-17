import { Task } from '../algorithm/model/Task';

/**
 * Thread-safe shared queue of tasks for dynamic work distribution.
 * Safe in Node.js because the event loop is single-threaded, 
 * no concurrent pull() calls can interleave within a single tick.
 *
 * References:
 * https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick - why no mutex is needed
 * https://en.wikipedia.org/wiki/Work_stealing - general idea of a shared queue for work stealing
 */
export class WorkQueue {
  private readonly tasks: Task[];

  /**
   * All tasks to distribute, sorted via descending by duration so
   * workers always pull the heaviest remaining test first (LPT-style).
   */
  constructor(tasks: Task[]) {
    this.tasks = [...tasks].sort((a, b) => b.duration - a.duration);
  }

  pull(): Task | undefined {
    return this.tasks.shift();
  }

  get remaining(): number {
    return this.tasks.length;
  }

  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }
}

// Per-worker deque for work stealing, each worker owns one WorkerQueue.
export class WorkerQueue {
  readonly tasks: Task[];

  constructor(tasks: Task[]) {
    this.tasks = [...tasks].sort((a, b) => b.duration - a.duration);
  }

  pop(): Task | undefined {
    return this.tasks.shift();
  }

  // Steal the largest (front) task from this queue.
  steal(): Task | undefined {
    return this.tasks.shift();
  }

  get totalWork(): number {
    return this.tasks.reduce((s, t) => s + t.duration, 0);
  }

  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }
}
