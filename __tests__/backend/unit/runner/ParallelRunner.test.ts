import { EventEmitter } from 'events';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));
jest.mock('fs', () => ({ writeFileSync: jest.fn(), unlinkSync: jest.fn() }));

import { runJob, runAllJobs, runAllJobsDynamic } from '../../../../src/backend/runner/ParallelRunner';
import { Job } from '../../../../src/backend/algorithm/model/Job';
import { Task } from '../../../../src/backend/algorithm/model/Task';

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
});
