import { Task } from '../model/Task';
import { Job } from '../model/Job';

// Helper functions for input and output validation before performing scheduling.

export function validateInputs(tasks: Task[], jobCount: number): void {
  if (jobCount <= 0) {
    throw new Error('Job count must be greater than zero');
  }
  if (tasks.length === 0) {
    throw new Error('No tasks provided for scheduling');
  }

  const taskIds = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    if (task.duration < 0) {
      throw new Error(`Negative duration for task ${task.id}`);
    }
    if (!Number.isFinite(task.duration)) {
      throw new Error(`Invalid duration for task ${task.id}`);
    }

    const dependencies = task.dependencies ?? [];
    if (!Array.isArray(dependencies)) {
      throw new Error(`Dependencies for task ${task.id} must be an array`);
    }

    for (const dependency of dependencies) {
      if (typeof dependency !== 'string' || dependency.length === 0) {
        throw new Error(`Invalid dependency id for task ${task.id}`);
      }
      if (dependency === task.id) {
        throw new Error(`Task ${task.id} cannot depend on itself`);
      }
      if (!taskIds.has(dependency)) {
        throw new Error(`Task ${task.id} depends on unknown task ${dependency}`);
      }
    }
  }
}

export function validateOutput(tasks: Task[], jobs: Job[]): void {
  const assigned = new Set<string>();

  for (const job of jobs) {
    for (const task of job.tasks) {
      if (assigned.has(task.id)) {
        throw new Error(`Duplicate task assignment: ${task.id}`);
      }
      assigned.add(task.id);
    }
  }

  if (assigned.size !== tasks.length) {
    throw new Error('Not all tasks were assigned');
  }
}
