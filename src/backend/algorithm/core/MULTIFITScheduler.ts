/**
 * References:
 *
 * MULTIFIT Algorithm:
 * https://www.sciencedirect.com/science/article/pii/0166218X88900790
 * https://www.keiruaprod.fr/blog/2023/03/31/the-multiway-number-partitioning-problem.html
 * https://en.wikipedia.org/wiki/Multifit_algorithm#The_algorithm
 *
 * First Fit Decreasing Algorithm:
 * https://www.savemyexams.com/a-level/further-maths/edexcel/17/decision-1/revision-notes/algorithms-and-graph-theory/algorithms/bin-packing-algorithms/
 */

import { Task } from '../model/Task';
import { Job } from '../model/Job';
import { JobDistribution } from '../model/JobDistribution';
import { computeMetrics } from '../metrics/SchedulingMetrics';
import { validateInputs, validateOutput } from '../validation/SchedulerValidator';

export class MULTIFITScheduler {
  // 7 iterations gives a worst-case makespan ratio of <= 1.22 * OPT - (Coffman, Garey, Johnson 1978 see ScienceDirect reference above).
  private static readonly ITERATIONS = 7;

  schedule(tasks: Task[], jobCount: number): JobDistribution {
    validateInputs(tasks, jobCount);

    const sorted = [...tasks].sort((a, b) => b.duration - a.duration);
    const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);
    const maxTask = sorted[0].duration;

    // Theoretical lower bound: makespan can never be less than the largest task or the average load per job.
    let lo = Math.max(maxTask, totalDuration / jobCount);
    // Upper bound: all tasks sequentially in one job.
    let hi = totalDuration;

    let bestAssignment: Job[] | null = null;

    for (let iter = 0; iter < MULTIFITScheduler.ITERATIONS; iter++) {
      const mid = (lo + hi) / 2;
      const assignment = this.ffd(sorted, jobCount, mid);

      if (assignment !== null) {
        bestAssignment = assignment; // Feasible, record and try a tighter makespan.
        hi = mid;
      } else {
        lo = mid; // Infeasible, relax the makespan.
      }
    }

    /**
     * hi is always feasible after the first iteration (lo is provably feasible at start).
     * If binary search never found a feasible mid, fall back to the upper bound.
     */ 
    if (bestAssignment === null) {
      bestAssignment = this.ffd(sorted, jobCount, hi)!;
    }

    validateOutput(tasks, bestAssignment);

    return {
      jobs: bestAssignment,
      jobCount,
      totalDuration,
      metrics: computeMetrics(bestAssignment, totalDuration)
    };
  }

  /**
   * First Fit Decreasing bin packing.
   *
   * Iterates tasks in descending duration order and places each into the first
   * existing job where it fits (job.totalTime + task.duration <= binCapacity).
   * Opens a new job if none fits. Returns null if more than jobCount jobs are needed, signalling that binCapacity is infeasible.
   */
  private ffd(sorted: Task[], jobCount: number, binCapacity: number): Job[] | null {
    const jobs: Job[] = [];

    for (const task of sorted) {
      let placed = false;

      for (const job of jobs) {
        if (job.totalTime + task.duration <= binCapacity) {
          job.addTask(task);
          placed = true;
          break;
        }
      }

      if (!placed) {
        if (jobs.length >= jobCount) {
          return null; // Exceeded allowed bin count makespan is infeasible.
        }
        const newJob = new Job(jobs.length);
        newJob.addTask(task);
        jobs.push(newJob);
      }
    }

    // Pad with empty jobs so the result always contains exactly jobCount jobs.
    while (jobs.length < jobCount) {
      jobs.push(new Job(jobs.length));
    }

    return jobs;
  }
}
