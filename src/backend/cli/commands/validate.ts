import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import YAML from 'yaml';
import { EXIT_FAILURE } from '../constants';

type Platform = 'github' | 'gitlab';

export function buildValidateCommand(y: Argv): Argv {
  return y
    .option('file', {
      type: 'string',
      demandOption: true,
      describe: 'Path to the CI configuration file to validate',
    })
    .option('platform', {
      type: 'string',
      choices: ['github', 'gitlab'],
      default: 'github',
      describe: 'Target CI platform',
    });
}

export function handleValidateCommand(argv: any): void {
  const filePath = path.resolve(argv.file as string);
  const platform = argv.platform as Platform;

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: file does not exist: ${filePath}`));
    process.exit(EXIT_FAILURE);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: any;

  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    console.error(chalk.red('Invalid YAML syntax'));
    if (err instanceof Error) console.error(chalk.red(err.message));
    process.exit(EXIT_FAILURE);
  }

  const issues: string[] = [];

  if (platform === 'github') {
    if (!parsed.on) issues.push('Missing required field: on (trigger)');
    if (!parsed.jobs || Object.keys(parsed.jobs).length === 0)
      issues.push('Missing required field: jobs');
    for (const [name, job] of Object.entries<any>(parsed.jobs ?? {})) {
      if (!job.steps || job.steps.length === 0)
        issues.push(`Job "${name}": missing steps`);
    }
  }

  if (platform === 'gitlab') {
    if (!parsed.stages || parsed.stages.length === 0)
      issues.push('Missing required field: stages');
    const jobEntries = Object.entries<any>(parsed).filter(
      ([k]) => k !== 'stages',
    );
    if (jobEntries.length === 0) issues.push('No jobs defined');
    for (const [name, job] of jobEntries) {
      if (!job.script || job.script.length === 0)
        issues.push(`Job "${name}": missing script`);
    }
  }

  if (issues.length > 0) {
    console.error(
      chalk.red(
        `Validation failed (${issues.length} issue${issues.length > 1 ? 's' : ''})`,
      ),
    );
    issues.forEach((issue) => console.error(chalk.red(`  - ${issue}`)));
    process.exit(EXIT_FAILURE);
  }

  console.log(
    chalk.green(
      `${filePath} is a valid ${platform === 'github' ? 'GitHub Actions' : 'GitLab CI'} configuration.`,
    ),
  );
}
