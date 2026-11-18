import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Job } from '../algorithm/model/Job';
import { Task } from '../algorithm/model/Task';
import { WorkQueue, WorkerQueue } from './WorkQueue';
import { wrapWithAffinity } from './CoreAffinity';

const MAX_INLINE_ARG = 50_000;

export interface JobResult {
  jobId: number;
  testNames: string[];
  wallClockMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * References:
 * https://nodejs.org/api/child_process.html - for spawn and handling stdout/stderr
 * https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript - to escape test names in regex patterns
 * https://bun.com/reference/node/buffer/Buffer - for efficient buffering of stdout/stderr data
 */

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Flags like "-Dtest=" need the value glued on directly (Java's -Dkey=value
// syntax breaks on whitespace); flags like "--testNamePattern" need a space.
function joinFlag(flag: string, value: string): string {
  return flag.endsWith('=') ? `${flag}${value}` : `${flag} ${value}`;
}

// "-Dtest=" style flags (Maven Surefire) take a literal/glob class name, not
// a regex - escaping it breaks pattern matching (e.g. "org\.apache\...").
// Regex-pattern flags like "--testNamePattern" need the name escaped.
function filterValue(name: string, filterFlag: string): string {
  return filterFlag.endsWith('=') ? name : escapeRegex(name);
}

export function runJob(job: Job, cmd: string, filterFlag: string, filterJoin: string, coreId?: number, cwd?: string): Promise<JobResult> {
  return new Promise((resolve) => {
    const testNames = job.tasks.map((t) => t.id);
    const filter = testNames.map((n) => filterValue(n, filterFlag)).join(filterJoin);

    let fullCmd: string;
    let tempFile: string | null = null;

    if (filter.length > MAX_INLINE_ARG) {
      tempFile = join(tmpdir(), `testsplit-job-${job.jobId}-${Date.now()}.txt`);
      writeFileSync(tempFile, filter);
      fullCmd = `${cmd} ${joinFlag(filterFlag, `@${tempFile}`)}`;
    } else {
      fullCmd = `${cmd} ${joinFlag(filterFlag, JSON.stringify(filter))}`;
    }

    if (coreId !== undefined) {
      fullCmd = wrapWithAffinity(fullCmd, coreId);
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const start = performance.now();
    const child = spawn('sh', ['-c', fullCmd], { stdio: 'pipe', cwd });

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      if (tempFile) try { unlinkSync(tempFile); } catch (e) { console.log('Failed to cleanup temp file', e); } // cleanup temp file it created
      resolve({
        jobId: job.jobId,
        testNames,
        wallClockMs: performance.now() - start,
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
      });
    });
  });
}

export function runAllJobs(jobs: Job[], cmd: string, filterFlag: string, filterJoin: string, coreIds?: number[], cwd?: string): Promise<JobResult[]> {
  const activeJobs = jobs.filter((j) => j.tasks.length > 0);
  return Promise.all(activeJobs.map((j, i) => runJob(j, cmd, filterFlag, filterJoin, coreIds?.[i], cwd)));
}

function runSingleTest(task: Task, cmd: string, filterFlag: string, cwd?: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const fullCmd = `${cmd} ${joinFlag(filterFlag, JSON.stringify(filterValue(task.id, filterFlag)))}`;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const child = spawn('sh', ['-c', fullCmd], { stdio: 'pipe', cwd });
    child.stdout.on('data', (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on('data', (c: Buffer) => stderrChunks.push(c));
    child.on('close', (code) => resolve({
      exitCode: code ?? 1,
      stdout: Buffer.concat(stdoutChunks).toString(),
      stderr: Buffer.concat(stderrChunks).toString(),
    }));
  });
}

async function runWorkerDynamic(initialTasks: Task[], sharedQueue: WorkQueue, jobId: number, cmd: string, filterFlag: string, cwd?: string): Promise<JobResult> {
  const start = performance.now();
  const testNames: string[] = [];
  let exitCode = 0;
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];
  const localQueue = [...initialTasks];

  while (true) {
    const task = localQueue.shift() ?? sharedQueue.pull();
    if (!task) break;

    testNames.push(task.id);
    const result = await runSingleTest(task, cmd, filterFlag, cwd);
    if (result.exitCode !== 0) exitCode = result.exitCode;
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
  }

  return {
    jobId,
    testNames,
    wallClockMs: performance.now() - start,
    exitCode,
    stdout: stdoutParts.join(''),
    stderr: stderrParts.join(''),
  };
}

/**
 * Dynamic work queue: each worker starts with its statically assigned tasks,
 * then pulls from the shared queue when its local queue empties, no worker goes idle while tests remain.
 */
export function runAllJobsDynamic(jobs: Job[], cmd: string, filterFlag: string, cwd?: string): Promise<JobResult[]> {
  const activeJobs = jobs.filter((j) => j.tasks.length > 0);
  const sharedQueue = new WorkQueue(activeJobs.flatMap((j) => j.tasks));
  return Promise.all(activeJobs.map((j) => runWorkerDynamic([], sharedQueue, j.jobId, cmd, filterFlag, cwd)));
}

async function runWorkerStealing(myQueue: WorkerQueue, allQueues: WorkerQueue[], jobId: number, cmd: string, filterFlag: string, cwd?: string): Promise<JobResult> {
  const start = performance.now();
  const testNames: string[] = [];
  let exitCode = 0;
  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];

  while (true) {
    let task = myQueue.pop();

    if (!task) {
      const victim = allQueues
        .filter((q) => q !== myQueue && !q.isEmpty)
        .sort((a, b) => b.totalWork - a.totalWork)[0];
      task = victim?.steal();
      if (!task) break;
    }

    testNames.push(task.id);
    const result = await runSingleTest(task, cmd, filterFlag, cwd);
    if (result.exitCode !== 0) exitCode = result.exitCode;
    stdoutParts.push(result.stdout);
    stderrParts.push(result.stderr);
  }

  return { jobId, testNames, wallClockMs: performance.now() - start, exitCode, stdout: stdoutParts.join(''), stderr: stderrParts.join('') };
}

export function runAllJobsWorkStealing(jobs: Job[], cmd: string, filterFlag: string, cwd?: string): Promise<JobResult[]> {
  const activeJobs = jobs.filter((j) => j.tasks.length > 0);
  const queues = activeJobs.map((j) => new WorkerQueue(j.tasks));
  return Promise.all(activeJobs.map((j, i) => runWorkerStealing(queues[i], queues, j.jobId, cmd, filterFlag, cwd)));
}
