import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

type Platform = 'github' | 'gitlab';

function isMavenTestLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(mvn|\.\/mvnw)\b/.test(trimmed) && !trimmed.includes('-DskipTests');
}

export function findExistingCIFile(platform: Platform): string | null {
  if (platform === 'github') {
    const workflowsDir = path.resolve('.github/workflows');
    if (!fs.existsSync(workflowsDir)) return null;

    const files = fs
      .readdirSync(workflowsDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

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

export function findTestJobs(config: any, platform: Platform): string[] {
  const testJobs: string[] = [];
  if (!config) return testJobs;

  if (platform === 'github') {
    const jobs = config.jobs ?? {};
    for (const [jobName, job] of Object.entries<any>(jobs)) {
      const steps = job.steps ?? [];
      for (const step of steps) {
        if (
          typeof step.run === 'string' &&
          (/^(mvn|\.\/mvnw)\b/.test(step.run.trim())
            ? isMavenTestLine(step.run)
            : step.run.toLowerCase().includes('test'))
        ) {
          testJobs.push(jobName);
          break;
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const [jobName, job] of Object.entries<any>(config)) {
      const script = job?.script;
      if (!script) continue;
      const lines = Array.isArray(script) ? script : [script];
      if (
        lines.some((l) =>
          /^(mvn|\.\/mvnw)\b/.test(l.trim())
            ? isMavenTestLine(l)
            : l.toLowerCase().includes('test'),
        )
      ) {
        testJobs.push(jobName);
      }
    }
  }

  return testJobs;
}

export function extractTestCommands(
  config: any,
  platform: Platform,
  testJobs: string[],
): string[] {
  const commands: string[] = [];
  if (!config) return commands;

  if (platform === 'github') {
    for (const jobName of testJobs) {
      const job = config.jobs?.[jobName];
      const steps = job?.steps ?? [];
      for (const step of steps) {
        if (
          typeof step.run === 'string' &&
          (/^(mvn|\.\/mvnw)\b/.test(step.run.trim())
            ? isMavenTestLine(step.run)
            : step.run.toLowerCase().includes('test'))
        ) {
          commands.push(step.run.trim());
        }
      }
    }
  }

  if (platform === 'gitlab') {
    for (const jobName of testJobs) {
      const job = config[jobName];
      const script = job?.script;
      if (!script) continue;
      const lines = Array.isArray(script) ? script : [script];
      for (const line of lines) {
        if (
          /^(mvn|\.\/mvnw)\b/.test(line.trim())
            ? isMavenTestLine(line)
            : line.toLowerCase().includes('test')
        ) {
          commands.push(line.trim());
        }
      }
    }
  }

  return commands;
}
