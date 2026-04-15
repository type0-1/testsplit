import { Task } from '../algorithm/model/Task';

export function toMavenClassName(testId: string): string {
  const stripped = testId.replace(/\(.*$/, '').replace(/\[.*$/, '');
  const parts = stripped.split('.');
  // A method segment is lowerCamelCase: starts with lowercase and contains at least one uppercase letter.
<<<<<<< HEAD
  // Package segments are all-lowercase; class names start with uppercase — neither qualify as method-like.
=======
  // Package segments are all lowercase; class names start with uppercase neither qualify as method-like.
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
  const last = parts[parts.length - 1];
  const isMethodLike = parts.length > 1 && /^[a-z]/.test(last) && /[A-Z]/.test(last);
  return isMethodLike ? parts.slice(0, -1).join('.') : stripped;
}

export function buildJobsWithDependencies(
  distributionJobs: { tasks: Task[] }[],
): { id: number; tests: string[]; needs?: number[] }[] {
  const taskToJobId = new Map<string, number>();

  distributionJobs.forEach((job, index) => {
    const jobId = index + 1;
    for (const task of job.tasks) {
      taskToJobId.set(task.id, jobId);
    }
  });

  return distributionJobs.map((job, index) => {
    const jobId = index + 1;
    const needs = new Set<number>();

    for (const task of job.tasks) {
      for (const dependencyId of task.dependencies ?? []) {
        const dependencyJobId = taskToJobId.get(dependencyId);
        if (dependencyJobId !== undefined && dependencyJobId !== jobId) {
          needs.add(dependencyJobId);
        }
      }
    }

    const sortedNeeds = [...needs].sort((a, b) => a - b);

    return {
      id: jobId,
      tests: job.tasks.map((t) => t.id),
      ...(sortedNeeds.length > 0 ? { needs: sortedNeeds } : {}),
    };
  });
}

export function groupSlotsIntoRunners(
  slots: { tasks: Task[] }[],
  runnerCores: number,
): { id: number; tests: string[] }[] {
  const n = Math.max(1, runnerCores);
  const runnerCount = Math.ceil(slots.length / n);
  const runners: { id: number; tests: string[] }[] = Array.from(
    { length: runnerCount },
    (_, i) => ({ id: i + 1, tests: [] }),
  );

  slots.forEach((slot, idx) => {
    const runnerIdx = Math.floor(idx / n);
    runners[runnerIdx].tests.push(...slot.tasks.map((t) => t.id));
  });

  return runners;
}
