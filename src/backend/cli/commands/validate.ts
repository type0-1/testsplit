import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import YAML from 'yaml';
import { EXIT_FAILURE } from '../constants';

type Platform = 'github' | 'gitlab';
type GenericRecord = Record<string, unknown>;

function toRecord(value: unknown): GenericRecord {
  return typeof value === 'object' && value !== null
    ? (value as GenericRecord)
    : {};
}

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

export function handleValidateCommand(argv: Record<string, unknown>): void {
  const filePath = path.resolve(argv.file as string);
  const platform = argv.platform as Platform;

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: file does not exist: ${filePath}`));
    process.exit(EXIT_FAILURE);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    console.error(chalk.red('Invalid YAML syntax'));
    if (err instanceof Error) console.error(chalk.red(err.message));
    process.exit(EXIT_FAILURE);
  }

  const issues: string[] = [];
  const parsedObj = toRecord(parsed);

  if (platform === 'github') {
    if (!parsedObj.on) issues.push('Missing required field: on (trigger)');
    const jobs = toRecord(parsedObj.jobs);
    if (Object.keys(jobs).length === 0)
      issues.push('Missing required field: jobs');
    for (const [name, job] of Object.entries(jobs)) {
      const steps = toRecord(job).steps;
      if (!Array.isArray(steps) || steps.length === 0)
        issues.push(`Job "${name}": missing steps`);
    }
  }

  if (platform === 'gitlab') {
    const stages = parsedObj.stages;
    if (!Array.isArray(stages) || stages.length === 0)
      issues.push('Missing required field: stages');
    const jobEntries = Object.entries(parsedObj).filter(
      ([k]) => k !== 'stages',
    );
    if (jobEntries.length === 0) issues.push('No jobs defined');
    for (const [name, job] of jobEntries) {
      const script = toRecord(job).script;
      if (!(Array.isArray(script) ? script.length > 0 : Boolean(script)))
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
