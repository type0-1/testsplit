import { Task } from '../algorithm/model/Task';

/**
 * Thread-safe shared queue of tasks for dynamic work distribution.
 * Safe in Node.js because the event loop is single-threaded, 
 * no concurrent pull() calls can interleave within a single tick.
 *
 * References:
 * https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick - why no mutex is needed
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
