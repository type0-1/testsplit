import { Task } from '../algorithm/model/Task';

export function toMavenClassName(testId: string): string {
  const stripped = testId.replace(/\(.*$/, '').replace(/\[.*$/, '');
  const parts = stripped.split('.');
  const methodIdx = parts.reduce(
    (last, p, i) => (/^[a-z]/.test(p) ? i : last),
    -1,
  );
  return methodIdx > 0 ? parts.slice(0, methodIdx).join('.') : stripped;
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
  const runners: { id: number; tests: string[] }[] = [];
  for (let i = 0; i < slots.length; i += n) {
    const group = slots.slice(i, i + n);
    const tests = group.flatMap((slot) => slot.tasks.map((t) => t.id));
    runners.push({ id: runners.length + 1, tests });
  }
  return runners;
}
