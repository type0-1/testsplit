import { spawn } from 'child_process';
import { Job } from '../algorithm/model/Job';

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

export function runJob(job: Job, cmd: string, filterFlag: string, filterJoin: string): Promise<JobResult> {
  return new Promise((resolve) => {
    const testNames = job.tasks.map((t) => t.id);
    const filter = testNames.map(escapeRegex).join(filterJoin);
    const fullCmd = `${cmd} ${filterFlag} ${JSON.stringify(filter)}`;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const start = performance.now();
    const child = spawn('sh', ['-c', fullCmd], { stdio: 'pipe' });

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
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

export function runAllJobs(jobs: Job[], cmd: string, filterFlag: string, filterJoin: string): Promise<JobResult[]> {
  const activeJobs = jobs.filter((j) => j.tasks.length > 0);
  return Promise.all(activeJobs.map((j) => runJob(j, cmd, filterFlag, filterJoin)));
}
