import { Task } from './Task';

export class Job {
  readonly jobId: number;
  readonly tasks: Task[] = [];
  totalTime = 0;

  constructor(jobId: number) {
    this.jobId = jobId;
  }

  addTask(task: Task): void {
    this.tasks.push(task);
    this.totalTime += task.duration;
  }
}
