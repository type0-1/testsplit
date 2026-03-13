import { Task } from '../model/Task';
import { Job } from '../model/Job';
import { JobDistribution } from '../model/JobDistribution';
import { computeMetrics } from '../metrics/SchedulingMetrics';
import { validateInputs, validateOutput } from '../validation/SchedulerValidator';

/**
 * References: 
 *  - res/references/Bounds_On_Multiprocessing_Timing_Anomalies.pdf
 *  - res/references/lpt4_3.pdf
 */

export class LPTScheduler {

  schedule(tasks: Task[], jobCount: number): JobDistribution {
    validateInputs(tasks, jobCount); // Explicitly validate to satisfy LPT assumptions

    const sorted = this.topologicalLptOrder(tasks);
    const jobs: Job[] = [];

    for (let i = 0; i < jobCount; i++) {
      jobs.push(new Job(i));
    }

    for (const task of sorted) {
      const lightestJob = jobs.reduce((min, job) => job.totalTime < min.totalTime ? job : min); // Greedily choose job w/ lightest load and assign to task.
      lightestJob.addTask(task);
    }

    validateOutput(tasks, jobs);
    
    const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);

    return {
      jobs,
      jobCount,
      totalDuration,
      metrics: computeMetrics(jobs, totalDuration)
    };
  }

  private topologicalLptOrder(tasks: Task[]): Task[] {
    const taskById = new Map<string, Task>();
    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const task of tasks) {
      taskById.set(task.id, task);
      indegree.set(task.id, 0);
      adjacency.set(task.id, []);
    }

    for (const task of tasks) {
      const uniqueDependencies = new Set(task.dependencies ?? []);
      for (const dependencyId of uniqueDependencies) {
        adjacency.get(dependencyId)!.push(task.id);
        indegree.set(task.id, indegree.get(task.id)! + 1);
      }
    }

    const ready: Task[] = tasks.filter((task) => indegree.get(task.id) === 0);
    const ordered: Task[] = [];

    while (ready.length > 0) {
      ready.sort((a, b) => b.duration - a.duration || a.id.localeCompare(b.id));
      const current = ready.shift()!;
      ordered.push(current);

      for (const dependentId of adjacency.get(current.id)!) {
        const nextIndegree = indegree.get(dependentId)! - 1;
        indegree.set(dependentId, nextIndegree);
        if (nextIndegree === 0) {
          ready.push(taskById.get(dependentId)!);
        }
      }
    }

    if (ordered.length !== tasks.length) {
      throw new Error('Dependency cycle detected in tasks');
    }

    return ordered;
  }

}
