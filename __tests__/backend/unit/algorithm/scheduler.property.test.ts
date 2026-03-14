import fc from 'fast-check';
import { LPTScheduler } from '../../../../src/backend/algorithm/core/LPTScheduler';
import { MULTIFITScheduler } from '../../../../src/backend/algorithm/core/MULTIFITScheduler';
import { Task } from '../../../../src/backend/algorithm/model/Task';
import { JobDistribution } from '../../../../src/backend/algorithm/model/JobDistribution';

type Scheduler = { schedule(tasks: Task[], jobCount: number): JobDistribution };
type SchedulerEntry = { name: string; create: () => Scheduler };

const schedulers: SchedulerEntry[] = [
  { name: 'LPT', create: () => new LPTScheduler() },
  { name: 'MULTIFIT', create: () => new MULTIFITScheduler() },
];

const taskArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  duration: fc.double({ min: 0.001, max: 1000, noNaN: true, noDefaultInfinity: true }),
});

const tasksArb = fc.uniqueArray(taskArb, { minLength: 1, maxLength: 30, selector: (t) => t.id });
const jobCountArb = fc.integer({ min: 1, max: 8 });

describe.each(schedulers)('$name - property-based', ({ create }) => {
  it('partition invariant: every task assigned to exactly one job', () => {
    fc.assert(
      fc.property(tasksArb, jobCountArb, (tasks, jobCount) => {
        const result = create().schedule(tasks, jobCount);
        const assigned = result.jobs.flatMap((j) => j.tasks.map((t) => t.id));
        expect(new Set(assigned).size).toBe(tasks.length);
        expect(assigned).toHaveLength(tasks.length);
      }),
    );
  });

  it('conservation law: sum of task durations equals totalDuration and sum of job loads', () => {
    fc.assert(
      fc.property(tasksArb, jobCountArb, (tasks, jobCount) => {
        const result = create().schedule(tasks, jobCount);
        const taskSum = tasks.reduce((s, t) => s + t.duration, 0);
        const jobSum = result.jobs.reduce(
          (s, j) => s + j.tasks.reduce((js, t) => js + t.duration, 0),
          0,
        );
        expect(result.totalDuration).toBeCloseTo(taskSum, 5);
        expect(jobSum).toBeCloseTo(taskSum, 5);
      }),
    );
  });

  it('job count: result always contains exactly jobCount jobs', () => {
    fc.assert(
      fc.property(tasksArb, jobCountArb, (tasks, jobCount) => {
        const result = create().schedule(tasks, jobCount);
        expect(result.jobs.length).toBe(jobCount);
      }),
    );
  });

  it('lower bound: makespan >= max(maxTask, totalDuration / jobCount)', () => {
    fc.assert(
      fc.property(tasksArb, jobCountArb, (tasks, jobCount) => {
        const result = create().schedule(tasks, jobCount);
        const total = tasks.reduce((s, t) => s + t.duration, 0);
        const maxTask = Math.max(...tasks.map((t) => t.duration));
        const lb = Math.max(maxTask, total / jobCount);
        expect(result.metrics.criticalPath).toBeGreaterThanOrEqual(lb - 0.001);
      }),
    );
  });

  it('monotonicity: adding a job never increases the makespan', () => {
    fc.assert(
      fc.property(tasksArb, fc.integer({ min: 1, max: 7 }), (tasks, j) => {
        const r1 = create().schedule(tasks, j);
        const r2 = create().schedule(tasks, j + 1);
        expect(r2.metrics.criticalPath).toBeLessThanOrEqual(r1.metrics.criticalPath + 0.001);
      }),
    );
  });

  it('determinism: identical input always produces identical output', () => {
    fc.assert(
      fc.property(tasksArb, jobCountArb, (tasks, jobCount) => {
        const r1 = create().schedule(tasks, jobCount);
        const r2 = create().schedule(tasks, jobCount);
        expect(r1).toEqual(r2);
      }),
    );
  });
});
