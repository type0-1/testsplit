import { computeMetrics } from '../../../../src/backend/algorithm/metrics/SchedulingMetrics';
import { Job } from '../../../../src/backend/algorithm/model/Job';
import { Task } from '../../../../src/backend/algorithm/model/Task';

describe('SchedulingMetrics', () => {
  it('computes critical path as the longest job duration', () => {
    const job1 = new Job(0);
    const job2 = new Job(1);

    job1.addTask({ id: 'A', duration: 5 } as Task);
    job2.addTask({ id: 'B', duration: 10 } as Task);

    const metrics = computeMetrics([job1, job2], 15);

    expect(metrics.criticalPath).toBe(10);
  });

  it('computes job time correctly', () => {
    const job1 = new Job(0);
    const job2 = new Job(1);
    const metrics = computeMetrics([job1, job2], 20);

    expect(metrics.idealJobTime).toBe(10);
  });

  it('computes balance ratio correctly', () => {
    const job1 = new Job(0);
    const job2 = new Job(1);

    job1.addTask({ id: 'A', duration: 5 } as Task);
    job2.addTask({ id: 'B', duration: 15 } as Task);

    const metrics = computeMetrics([job1, job2], 20);

    expect(metrics.balanceRatio).toBe(15 / 10);
  });

  it('computes minimum job time correctly', () => {
    const job1 = new Job(0);
    const job2 = new Job(1);

    job1.addTask({ id: 'A', duration: 3 } as Task);
    job2.addTask({ id: 'B', duration: 7 } as Task);

    const metrics = computeMetrics([job1, job2], 10);

    expect(metrics.minJobTime).toBe(3);
  });
});
