import { validateInputs, validateOutput } from '../../../../src/backend/algorithm/validation/SchedulerValidator';
import { Task } from '../../../../src/backend/algorithm/model/Task';
import { Job } from '../../../../src/backend/algorithm/model/Job';

describe('SchedulerValidator', () => {
  describe('validateInputs', () => {
    it('throws when jobCount is zero or negative', () => {
      expect(() => validateInputs([{ id: 'A', duration: 5 }], 0)).toThrow();
      expect(() => validateInputs([{ id: 'A', duration: 5 }], -1)).toThrow();
    });

    it('throws when task list is empty', () => {
      expect(() => validateInputs([], 2)).toThrow();
    });

    it('throws when task duration is negative', () => {
      const tasks: Task[] = [{ id: 'A', duration: -5 }];
      expect(() => validateInputs(tasks, 1)).toThrow();
    });
    
    it('throws when task duration is NaN', () => {
      const tasks: Task[] = [{ id: 'A', duration: NaN }];
      expect(() => validateInputs(tasks, 1)).toThrow();
    });

    it('throws when dependencies is not an array', () => {
      const tasks = [
        { id: 'A', duration: 5, dependencies: 'B' as unknown as string[] },
        { id: 'B', duration: 3 },
      ] as Task[];

      expect(() => validateInputs(tasks, 2)).toThrow(
        'Dependencies for task A must be an array',
      );
    });

    it('throws when dependency id is invalid', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5, dependencies: [''] },
        { id: 'B', duration: 3 },
      ];

      expect(() => validateInputs(tasks, 2)).toThrow(
        'Invalid dependency id for task A',
      );
    });

    it('throws when a task depends on itself', () => {
      const tasks: Task[] = [{ id: 'A', duration: 5, dependencies: ['A'] }];

      expect(() => validateInputs(tasks, 1)).toThrow(
        'Task A cannot depend on itself',
      );
    });

    it('throws when a task depends on an unknown task', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5, dependencies: ['B'] },
      ];

      expect(() => validateInputs(tasks, 1)).toThrow(
        'Task A depends on unknown task B',
      );
    });

    it('accepts valid dependencies between known tasks', () => {
      const tasks: Task[] = [
        { id: 'A', duration: 5 },
        { id: 'B', duration: 3, dependencies: ['A'] },
      ];

      expect(() => validateInputs(tasks, 2)).not.toThrow();
    });

    it('accepts valid input', () => {
      const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 3 }];
      expect(() => validateInputs(tasks, 2)).not.toThrow();
    });
  });

  describe('validateOutput', () => {
    it('throws when a task is assigned more than once', () => {
      const task: Task = { id: 'A', duration: 5 };
      const job1 = new Job(0);
      const job2 = new Job(1);

      job1.addTask(task);
      job2.addTask(task); // The same task allocated to 2 different jobs

      expect(() => validateOutput([task], [job1, job2])).toThrow();
    });

    it('throws when not all tasks are assigned', () => {
      const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 3 }];
      const job = new Job(0);

      job.addTask(tasks[0]); // Task with ID "B" is never assigned

      expect(() => validateOutput(tasks, [job])).toThrow();
    });

    it('accepts valid job assignments', () => {
      const tasks: Task[] = [{ id: 'A', duration: 5 }, { id: 'B', duration: 3 }];
      const job1 = new Job(0);
      const job2 = new Job(1);

      job1.addTask(tasks[0]);
      job2.addTask(tasks[1]);

      expect(() => validateOutput(tasks, [job1, job2])).not.toThrow();
    });
  });
});
