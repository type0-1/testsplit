import { EventEmitter } from 'events';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));
jest.mock('fs', () => ({ writeFileSync: jest.fn(), unlinkSync: jest.fn() }));
jest.mock('../../../../src/backend/runner/CoreAffinity', () => ({
  wrapWithAffinity: jest.fn((cmd: string, coreId: number) => `affined(${coreId}):${cmd}`),
}));

import { runJob, runAllJobs, runAllJobsDynamic, runAllJobsWorkStealing } from '../../../../src/backend/runner/ParallelRunner';
import { Job } from '../../../../src/backend/algorithm/model/Job';
import { Task } from '../../../../src/backend/algorithm/model/Task';
import { wrapWithAffinity } from '../../../../src/backend/runner/CoreAffinity';

const mockWrapWithAffinity = wrapWithAffinity as jest.MockedFunction<typeof wrapWithAffinity>;

const task = (id: string, duration: number): Task => ({ id, duration });

function makeJob(jobId: number, tasks: Task[]): Job {
  const job = new Job(jobId);
  tasks.forEach((t) => job.addTask(t));
  return job;
}

function mockChild(stdout = '', stderr = '', exitCode = 0) {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  process.nextTick(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', exitCode);
  });
  return child;
}

function mockChildUndefinedExit(stdout = '', stderr = '') {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  process.nextTick(() => {
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', undefined);
  });
  return child;
}

beforeEach(() => mockSpawn.mockReset());

describe('runJob', () => {
  it('resolves with PASS result when process exits 0', async () => {
    mockSpawn.mockImplementation(() => mockChild('test output', '', 0));
    const job = makeJob(1, [task('TestA', 1), task('TestB', 2)]);
    const result = await runJob(job, 'mvn test', '-Dtest', '+');
    expect(result.jobId).toBe(1);
    expect(result.exitCode).toBe(0);
    expect(result.testNames).toEqual(['TestA', 'TestB']);
    expect(result.stdout).toBe('test output');
    expect(result.wallClockMs).toBeGreaterThanOrEqual(0);
  });

  it('resolves with FAIL result when process exits non-zero', async () => {
    mockSpawn.mockImplementation(() => mockChild('', 'error msg', 1));
    const job = makeJob(2, [task('TestC', 1)]);
    const result = await runJob(job, 'mvn test', '-Dtest', '+');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('error msg');
  });

  it('passes joined test names as the filter argument', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const job = makeJob(1, [task('A', 1), task('B', 2)]);
    await runJob(job, 'mvn test', '-Dtest', '+');
    const cmd = mockSpawn.mock.calls[0][1][1] as string;
    expect(cmd).toContain('-Dtest');
    expect(cmd).toContain('A');
    expect(cmd).toContain('B');
  });

  it('writes a temp file and uses @ syntax when filter exceeds 50k chars', async () => {
    const { writeFileSync } = require('fs');
    mockSpawn.mockImplementation(() => mockChild());
    const longTasks = Array.from({ length: 1000 }, (_, i) =>
      task('org.example.SomeLongPackage.VeryLongTestClassName' + i + '#testMethod' + i, 1),
    );
    const job = makeJob(1, longTasks);
    await runJob(job, 'mvn test', '-Dtest', '+');
    expect(writeFileSync).toHaveBeenCalled();
    const cmd = mockSpawn.mock.calls[0][1][1] as string;
    expect(cmd).toContain('@');
  });

  it('logs cleanup warning when temp-file unlink fails', async () => {
    const { unlinkSync } = require('fs');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    unlinkSync.mockImplementationOnce(() => {
      throw new Error('cannot unlink');
    });
    mockSpawn.mockImplementation(() => mockChild());

    const longTasks = Array.from({ length: 1000 }, (_, i) =>
      task('org.example.SomeLongPackage.VeryLongTestClassName' + i + '#testMethod' + i, 1),
    );
    const job = makeJob(10, longTasks);

    await runJob(job, 'mvn test', '-Dtest', '+');

    expect(logSpy).toHaveBeenCalledWith('Failed to cleanup temp file', expect.any(Error));
    logSpy.mockRestore();
  });

  it('wraps command with CPU affinity when coreId is provided', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const job = makeJob(7, [task('AffinityTest', 1)]);

    await runJob(job, 'mvn test', '-Dtest', '+', 3);

    expect(mockWrapWithAffinity).toHaveBeenCalledWith(expect.any(String), 3);
    const cmd = mockSpawn.mock.calls[0][1][1] as string;
    expect(cmd).toContain('affined(3):');
  });

  it('defaults exitCode to 1 when child closes with undefined code', async () => {
    mockSpawn.mockImplementation(() => mockChildUndefinedExit());
    const job = makeJob(9, [task('UndefinedExit', 1)]);

    const result = await runJob(job, 'mvn test', '-Dtest', '+');

    expect(result.exitCode).toBe(1);
  });
});

describe('runAllJobs', () => {
  it('skips jobs with no tasks', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [makeJob(1, [task('A', 1)]), makeJob(2, [])];
    const results = await runAllJobs(jobs, 'mvn test', '-Dtest', '+');
    expect(results).toHaveLength(1);
    expect(results[0].jobId).toBe(1);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('runs all active jobs in parallel and returns all results', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [makeJob(1, [task('A', 1)]), makeJob(2, [task('B', 2)]), makeJob(3, [task('C', 3)])];
    const results = await runAllJobs(jobs, 'mvn test', '-Dtest', '+');
    expect(results).toHaveLength(3);
    expect(mockSpawn).toHaveBeenCalledTimes(3);
  });

  it('passes per-job core ids through optional coreIds array', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [makeJob(1, [task('A', 1)]), makeJob(2, [task('B', 1)])];

    await runAllJobs(jobs, 'mvn test', '-Dtest', '+', [4, 5]);

    expect(mockWrapWithAffinity).toHaveBeenCalledWith(expect.any(String), 4);
    expect(mockWrapWithAffinity).toHaveBeenCalledWith(expect.any(String), 5);
  });
});

describe('runAllJobsDynamic', () => {
  it('distributes all tasks across workers with no task dropped or duplicated', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [
      makeJob(1, [task('A', 3), task('B', 2)]),
      makeJob(2, [task('C', 1)]),
    ];
    const results = await runAllJobsDynamic(jobs, 'mvn test', '-Dtest');
    const allTests = results.flatMap((r) => r.testNames).sort();
    expect(allTests).toEqual(['A', 'B', 'C']);
  });

  it('returns one result per active job', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [makeJob(1, [task('A', 1)]), makeJob(2, [task('B', 1)]), makeJob(3, [])];
    const results = await runAllJobsDynamic(jobs, 'echo', '-t');
    expect(results).toHaveLength(2);
  });

  it('records a non-zero exit code when a test fails', async () => {
    mockSpawn.mockImplementationOnce(() => mockChild('', '', 0)).mockImplementation(() => mockChild('', 'fail', 1));
    const jobs = [makeJob(1, [task('A', 1), task('B', 1)])];
    const results = await runAllJobsDynamic(jobs, 'mvn test', '-Dtest');
    expect(results[0].exitCode).toBe(1);
  });

  it('defaults worker test exitCode to 1 when child closes with undefined code', async () => {
    mockSpawn.mockImplementation(() => mockChildUndefinedExit());
    const jobs = [makeJob(1, [task('A', 1)])];

    const results = await runAllJobsDynamic(jobs, 'mvn test', '-Dtest');

    expect(results[0].exitCode).toBe(1);
  });
});

describe('runAllJobsWorkStealing', () => {
  it('returns one result per active job and skips empty jobs', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [makeJob(1, [task('A', 1)]), makeJob(2, []), makeJob(3, [task('B', 1)])];
    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.jobId).sort()).toEqual([1, 3]);
  });

  it('executes all tests exactly once across workers (including stolen work)', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [
      makeJob(1, [task('A', 5), task('B', 4), task('C', 3)]),
      makeJob(2, [task('D', 1)]),
    ];
    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');
    const allTests = results.flatMap((r) => r.testNames).sort();
    expect(allTests).toEqual(['A', 'B', 'C', 'D']);
    expect(mockSpawn).toHaveBeenCalledTimes(4);
  });

  it('chooses among multiple victim queues (covers victim sort path)', async () => {
    mockSpawn.mockImplementation(() => mockChild());
    const jobs = [
      makeJob(1, [task('A', 10)]),
      makeJob(2, [task('B', 9), task('C', 8), task('D', 7)]),
      makeJob(3, [task('E', 6), task('F', 5), task('G', 4)]),
    ];

    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');
    const allTests = results.flatMap((r) => r.testNames).sort();

    expect(allTests).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(mockSpawn).toHaveBeenCalledTimes(7);
  });

  it('propagates non-zero exit code when any executed test fails', async () => {
    mockSpawn
      .mockImplementationOnce(() => mockChild('ok1', '', 0))
      .mockImplementationOnce(() => mockChild('', 'boom', 2))
      .mockImplementation(() => mockChild('okN', '', 0));

    const jobs = [
      makeJob(1, [task('A', 3), task('B', 2)]),
      makeJob(2, [task('C', 1)]),
    ];
    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');

    expect(results.some((r) => r.exitCode !== 0)).toBe(true);
    expect(results.flatMap((r) => r.stderr).join('')).toContain('boom');
  });

  it('returns empty when all jobs are empty', async () => {
    const jobs = [makeJob(1, []), makeJob(2, [])];
    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');
    expect(results).toEqual([]);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('handles a single active worker with no victim queue to steal from', async () => {
    mockSpawn.mockImplementation(() => mockChild('ok', '', 0));
    const jobs = [makeJob(1, [task('A', 1)])];

    const results = await runAllJobsWorkStealing(jobs, 'mvn test', '-Dtest');

    expect(results).toHaveLength(1);
    expect(results[0].testNames).toEqual(['A']);
    expect(results[0].exitCode).toBe(0);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });
});
