import { LPTScheduler } from '../../../../src/backend/algorithm/core/LPTScheduler'
import { Task } from '../../../../src/backend/algorithm/model/Task';

describe('LPTScheduler', () => {
  it('places the largest task first, minimising the critical path', () => {
    const tasks: Task[] = [{ id: 'A', duration: 10 }, { id: 'B', duration: 5 }, { id: 'C', duration: 5 }];
    const result = new LPTScheduler().schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(10);
  });

  it('handles a dominant outlier task without crashing', () => {
    const tasks: Task[] = [{ id: 'A', duration: 100 }, { id: 'B', duration: 1 }, { id: 'C', duration: 1 }, { id: 'D', duration: 1 }];
    const result = new LPTScheduler().schedule(tasks, 2);

    expect(result.metrics.criticalPath).toBe(100);
    expect(result.metrics.balanceRatio).toBeGreaterThan(1);
  });

  it('respects dependency order while scheduling longest ready tasks first', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 4 },
      { id: 'B', duration: 9, dependencies: ['A'] },
      { id: 'C', duration: 7 },
      { id: 'D', duration: 3, dependencies: ['B'] },
    ];

    const result = new LPTScheduler().schedule(tasks, 1);
    expect(result.jobs[0].tasks.map((t) => t.id)).toEqual(['C', 'A', 'B', 'D']);
  });

  it('throws when a task depends on an unknown task id', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 4, dependencies: ['Z'] },
      { id: 'B', duration: 5 },
    ];

    expect(() => new LPTScheduler().schedule(tasks, 2)).toThrow('depends on unknown task');
  });

  it('throws for cyclic dependencies', () => {
    const tasks: Task[] = [
      { id: 'A', duration: 5, dependencies: ['B'] },
      { id: 'B', duration: 6, dependencies: ['A'] },
    ];

    expect(() => new LPTScheduler().schedule(tasks, 2)).toThrow('Dependency cycle detected');
  });

  describe('lightest job selection with tie-breaking', () => {
    it('assigns task to job with lowest totalTime', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 3 },
        { id: 'C', duration: 2 },
      ];

      const result = new LPTScheduler().schedule(tasks, 2);

      // Job 0 should get A (5), Job 1 should get B (3) and C (2)
      expect(result.jobs[0].totalTime).toBe(5);
      expect(result.jobs[1].totalTime).toBe(5);
      expect(result.jobs[0].tasks[0].id).toBe('A');
    });

    it('uses task count tie-breaker when totalTime is equal', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 5 },
        { id: 'C', duration: 0 },
      ];

      const result = new LPTScheduler().schedule(tasks, 2);

      // A goes to Job 0 (5), B goes to Job 1 (5)
      // C has duration 0, both jobs have totalTime=5, but Job 1 has fewer tasks (1 vs 1), so use task count
      // Actually both have 1 task, so it picks the first one found (Job 0)
      // Wait, let's trace: A->Job0 (time=5, count=1), B->Job1 (time=5, count=1)
      // C: both jobs have time=5, Job0 has 1 task, Job1 has 1 task, same count, so reduce returns Job0
      expect(result.jobs[0].tasks.length).toBeGreaterThanOrEqual(2);
      expect(result.jobs[0].totalTime).toBe(5);
    });

    it('spreads zero-duration tasks evenly using task count tie-breaker', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 10 },
        { id: 'B', duration: 10 },
        { id: 'C', duration: 0 },
        { id: 'D', duration: 0 },
      ];

      const result = new LPTScheduler().schedule(tasks, 2);

      // A goes to Job 0 (time=10, tasks=1)
      // B goes to Job 1 (time=10, tasks=1)
      // C: both jobs have time=10, both have 1 task, reduce returns first: Job 0 (time=10, tasks=2)
      // D: Job 0 has time=10 tasks=2, Job 1 has time=10 tasks=1, pick Job 1 (fewer tasks)
      expect(result.jobs[0].tasks.length).toBe(2);
      expect(result.jobs[1].tasks.length).toBe(2);
      expect(result.jobs[0].totalTime).toBe(10);
      expect(result.jobs[1].totalTime).toBe(10);
    });

    it('correctly applies tie-breaker across multiple rounds', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 3 },
        { id: 'B', duration: 3 },
        { id: 'C', duration: 3 },
        { id: 'D', duration: 0 },
        { id: 'E', duration: 0 },
      ];

      const result = new LPTScheduler().schedule(tasks, 3);

      // A -> Job 0 (time=3, tasks=1)
      // B -> Job 1 (time=3, tasks=1)
      // C -> Job 2 (time=3, tasks=1)
      // D -> All have time=3 tasks=1, reduce returns Job 0 (time=3, tasks=2)
      // E -> Job 1 has time=3 tasks=1 (lightest), gets E
      expect(result.jobs[1].tasks.map((t) => t.id)).toEqual(['B', 'E']);
      expect(result.jobs[0].totalTime).toBe(3);
      expect(result.jobs[1].totalTime).toBe(3);
      expect(result.jobs[2].totalTime).toBe(3);
    });
  });

  describe('dependency processing and topological ordering', () => {
    it('adds task to ready queue when its indegree reaches zero', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 8, dependencies: ['A'] },
        { id: 'C', duration: 3 },
      ];

      const result = new LPTScheduler().schedule(tasks, 2);

      // A (5) and C (3) both ready initially, A is picked first (longest)
      // A placed in Job 0. Then B (8) becomes ready. C (3) still ready.
      // Pick B (8) for Job 1 (lighter), then C goes to Job 1
      const task0Ids = result.jobs[0].tasks.map((t) => t.id);
      const task1Ids = result.jobs[1].tasks.map((t) => t.id);
      expect(task0Ids).toContain('A');
      expect(task0Ids).toContain('C');
      expect(task1Ids).toContain('B');
    });

    it('correctly processes multiple dependents from single parent', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 10 },
        { id: 'B', duration: 5, dependencies: ['A'] },
        { id: 'C', duration: 5, dependencies: ['A'] },
        { id: 'D', duration: 5, dependencies: ['A'] },
      ];

      const result = new LPTScheduler().schedule(tasks, 1);

      // All tasks must be processed in order: A first, then B, C, D (all depend on A)
      expect(result.jobs[0].tasks.map((t) => t.id)).toEqual(['A', 'B', 'C', 'D']);
      expect(result.jobs[0].totalTime).toBe(25);
    });

    it('respects LPT order when multiple tasks become ready simultaneously', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 10, dependencies: ['A'] },
        { id: 'C', duration: 8, dependencies: ['A'] },
        { id: 'D', duration: 3, dependencies: ['A'] },
      ];

      const result = new LPTScheduler().schedule(tasks, 1);

      // After A, the ready queue has B(10), C(8), D(3)
      // LPT order should pick by duration: B, then C, then D
      expect(result.jobs[0].tasks.map((t) => t.id)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('handles diamond dependency pattern', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 3, dependencies: ['A'] },
        { id: 'C', duration: 3, dependencies: ['A'] },
        { id: 'D', duration: 2, dependencies: ['B', 'C'] },
      ];

      const result = new LPTScheduler().schedule(tasks, 2);

      // Verify dependency constraints are respected
      // A has no dependencies (should be first in topological order)
      // B and C depend on A
      // D depends on both B and C
      
      // All tasks should be scheduled
      const allTaskIds = result.jobs.flatMap((j) => j.tasks.map((t) => t.id));
      expect(allTaskIds).toContain('A');
      expect(allTaskIds).toContain('B');
      expect(allTaskIds).toContain('C');
      expect(allTaskIds).toContain('D');
      
      // The first task in the overall schedule should be A
      // (since it's the only one with no dependencies)
      let firstTask: string | null = null;
      for (const job of result.jobs) {
        if (job.tasks.length > 0) {
          firstTask = job.tasks[0].id;
          break;
        }
      }
      expect(firstTask).toBe('A');
    });

    it('maintains topological order with complex dependencies', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 2 },
        { id: 'B', duration: 3, dependencies: ['A'] },
        { id: 'C', duration: 4, dependencies: ['A'] },
        { id: 'D', duration: 2, dependencies: ['B', 'C'] },
        { id: 'E', duration: 1, dependencies: ['D'] },
      ];

      const result = new LPTScheduler().schedule(tasks, 1);

      const taskSequence = result.jobs[0].tasks.map((t) => t.id);
      
      // Verify A comes first
      expect(taskSequence.indexOf('A')).toBe(0);
      // Verify B comes after A
      expect(taskSequence.indexOf('B')).toBeGreaterThan(taskSequence.indexOf('A'));
      // Verify C comes after A
      expect(taskSequence.indexOf('C')).toBeGreaterThan(taskSequence.indexOf('A'));
      // Verify D comes after B and C
      expect(taskSequence.indexOf('D')).toBeGreaterThan(taskSequence.indexOf('B'));
      expect(taskSequence.indexOf('D')).toBeGreaterThan(taskSequence.indexOf('C'));
      // Verify E comes after D
      expect(taskSequence.indexOf('E')).toBeGreaterThan(taskSequence.indexOf('D'));
    });
  });
});
