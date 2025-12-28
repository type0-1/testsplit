import { Task } from '../model/Task';
import { Job } from '../model/Job';
import { JobDistribution } from '../model/JobDistribution';
import { computeMetrics } from '../metrics/SchedulingMetrics';
import { validateInputs, validateOutput } from '../validation/SchedulerValidator';

export class LPTScheduler {

  schedule(tasks: Task[], jobCount: number): JobDistribution {
    validateInputs(tasks, jobCount); // Explicitly validate to satisfy LPT assumptions
    
    const sorted = [...tasks].sort((a, b) => b.duration - a.duration); // LPT ordering (via descending duration)
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

}
