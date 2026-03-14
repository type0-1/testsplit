import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Job } from '../algorithm/model/Job';

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

export function runJob(job: Job, cmd: string, filterFlag: string, filterJoin: string): Promise<JobResult> {
  return new Promise((resolve) => {
    const testNames = job.tasks.map((t) => t.id);
    const filter = testNames.map(escapeRegex).join(filterJoin);

    let fullCmd: string;
    let tempFile: string | null = null;

    if (filter.length > MAX_INLINE_ARG) {
      tempFile = join(tmpdir(), `testsplit-job-${job.jobId}-${Date.now()}.txt`);
      writeFileSync(tempFile, filter);
      fullCmd = `${cmd} ${filterFlag} @${tempFile}`;
    } else {
      fullCmd = `${cmd} ${filterFlag} ${JSON.stringify(filter)}`;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const start = performance.now();
    const child = spawn('sh', ['-c', fullCmd], { stdio: 'pipe' });

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      if (tempFile) try { unlinkSync(tempFile); } catch {} // cleanup temp file it created
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
