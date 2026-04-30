import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { isMavenCommand, isMavenTestCommand } from '../generator/MavenCommand';

type Platform = 'github' | 'gitlab';
type GenericRecord = Record<string, unknown>;

function toRecord(value: unknown): GenericRecord {
  return typeof value === 'object' && value !== null ? (value as GenericRecord) : {};
}

function isGradleTestLine(line: string): boolean {
  const trimmed = line.trim();
  return /\b(build|test|check)\b/.test(trimmed) && !trimmed.includes('-x test');
}

function isTestLine(line: string): boolean {
  const trimmed = line.trim();
  if (isMavenCommand(trimmed)) return isMavenTestCommand(trimmed);
  if (/^(gradle|\.\/gradlew)\b/.test(trimmed)) return isGradleTestLine(trimmed);
  return trimmed.toLowerCase().includes('test');
}

export function findExistingCIFile(platform: Platform): string | null {
  if (platform === 'github') {
    const workflowsDir = path.resolve('.github/workflows');
    if (!fs.existsSync(workflowsDir)) return null;

    const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

    const fileWithTestJob = files.find((f) => {
      try {
        const raw = fs.readFileSync(path.join(workflowsDir, f), 'utf-8');
        const parsed = YAML.parse(raw);
        return findTestJobs(parsed, 'github').length > 0;
      } catch {
        return false;
      }
    });

    return fileWithTestJob ? path.join(workflowsDir, fileWithTestJob) : null;
  }

  if (platform === 'gitlab') {
    const gitlabPath = path.resolve('.gitlab-ci.yml');
    return fs.existsSync(gitlabPath) ? gitlabPath : null;
  }

  return null;
}

export function findTestJobs(config: unknown, platform: Platform): string[] {
  const testJobs: string[] = [];
  if (!config) return testJobs;

  if (platform === 'github') {
    const jobs = toRecord(toRecord(config).jobs);
    for (const [jobName, job] of Object.entries(jobs)) {
      const steps = Array.isArray(toRecord(job).steps) ? (toRecord(job).steps as unknown[]) : [];
      for (const step of steps) {
        const stepObj = toRecord(step);
        const run = stepObj.run;
        if (typeof run === 'string' && isTestLine(run)) {
          testJobs.push(jobName);
          break;
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const [jobName, job] of Object.entries(toRecord(config))) {
      const script = toRecord(job).script;
      if (!script) continue;
      const lines = Array.isArray(script) ? script : [script];
      if (
        lines.some((line) => {
          return typeof line === 'string' && isTestLine(line);
        })
      ) {
        testJobs.push(jobName);
      }
    }
  }

  return testJobs;
}

export function extractTestCommands(
  config: unknown,
  platform: Platform,
  testJobs: string[],
): string[] {
  const commands: string[] = [];
  if (!config) return commands;

  if (platform === 'github') {
    for (const jobName of testJobs) {
      const job = toRecord(toRecord(config).jobs)[jobName];
      const steps = Array.isArray(toRecord(job).steps) ? (toRecord(job).steps as unknown[]) : [];
      for (const step of steps) {
        const run = toRecord(step).run;
        if (typeof run === 'string' && isTestLine(run)) {
          commands.push(run.trim());
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const jobName of testJobs) {
      const job = toRecord(config)[jobName];
      const script = toRecord(job).script;
      if (!script) continue;
      const lines = Array.isArray(script) ? script : [script];
      for (const line of lines) {
        if (typeof line !== 'string') continue;
        if (isTestLine(line)) {
          commands.push(line.trim());
        }
      }
    }
  }

  return commands;
}
