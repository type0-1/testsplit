import { JobGroup } from './JobGroup';
import chalk from 'chalk';
import { validateJobGroups } from './JobGroupValidator';
import { getSchemaValidator } from './getSchemaValidator';
import { validateYamlSyntax } from './YAMLSyntaxValidator';
import { JobCommandBuilder, resolveJobCommandBuilder } from './JobCommandBuilder';

export interface CIResourceConstraints {
  cpuCores: number;
  memoryLimitMb: number | null;
}

function renderGitHubJob(job: JobGroup, buildJobCommand: JobCommandBuilder): string {
  const needsLine = job.needs && job.needs.length > 0 ? `\n    needs: [${job.needs.map((id) => `job-${id}`).join(', ')}]` : '';

  return `
  job-${job.id}:
    runs-on: ubuntu-latest${needsLine}
    steps:
      - uses: actions/checkout@v4
      - run: ${buildJobCommand(job.tests)}`;
}

export function generateGitHubActionsConfig(
  jobs: JobGroup[],
  mavenBinOrBuilder: string | JobCommandBuilder = 'mvn',
  resourceConstraints?: CIResourceConstraints,
): string {
  validateJobGroups(jobs, 'GitHub Actions');

  const buildJobCommand = resolveJobCommandBuilder(mavenBinOrBuilder);
  const jobsYaml = jobs.map((job) => renderGitHubJob(job, buildJobCommand)).join('\n');

  const constraintsComment = resourceConstraints
    ? `# Resource constraints captured during profiling\n# Keep baseline and optimized runs on identical container config\n# cpu_limit: ${resourceConstraints.cpuCores}\n# memory_limit_mb: ${resourceConstraints.memoryLimitMb ?? chalk.yellow('unknown')}\n\n`
    : '';

  const yamlOutput = `${constraintsComment}name: TestSplit CI\non: [push, pull_request]\njobs:${jobsYaml}\n`;

  validateYamlSyntax(yamlOutput);

  const validator = getSchemaValidator('github');
  validator?.validate(yamlOutput);

  return yamlOutput;
}
