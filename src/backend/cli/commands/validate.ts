import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Argv } from 'yargs';
import YAML from 'yaml';
import { EXIT_FAILURE } from '../constants';

type Platform = 'github' | 'gitlab';
<<<<<<< HEAD
type GenericRecord = Record<string, unknown>;

function toRecord(value: unknown): GenericRecord {
  return typeof value === 'object' && value !== null
    ? (value as GenericRecord)
    : {};
}
=======
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527

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

<<<<<<< HEAD
export function handleValidateCommand(argv: Record<string, unknown>): void {
=======
export function handleValidateCommand(argv: any): void {
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
  const filePath = path.resolve(argv.file as string);
  const platform = argv.platform as Platform;

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red(`Error: file does not exist: ${filePath}`));
    process.exit(EXIT_FAILURE);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
<<<<<<< HEAD
  let parsed: unknown;
=======
  let parsed: any;
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527

  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    console.error(chalk.red('Invalid YAML syntax'));
    if (err instanceof Error) console.error(chalk.red(err.message));
    process.exit(EXIT_FAILURE);
  }

  const issues: string[] = [];
<<<<<<< HEAD
  const parsedObj = toRecord(parsed);

  if (platform === 'github') {
    if (!parsedObj.on) issues.push('Missing required field: on (trigger)');
    const jobs = toRecord(parsedObj.jobs);
    if (Object.keys(jobs).length === 0)
      issues.push('Missing required field: jobs');
    for (const [name, job] of Object.entries(jobs)) {
      const steps = toRecord(job).steps;
      if (!Array.isArray(steps) || steps.length === 0)
=======

  if (platform === 'github') {
    if (!parsed.on) issues.push('Missing required field: on (trigger)');
    if (!parsed.jobs || Object.keys(parsed.jobs).length === 0)
      issues.push('Missing required field: jobs');
    for (const [name, job] of Object.entries<any>(parsed.jobs ?? {})) {
      if (!job.steps || job.steps.length === 0)
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
        issues.push(`Job "${name}": missing steps`);
    }
  }

  if (platform === 'gitlab') {
<<<<<<< HEAD
    const stages = parsedObj.stages;
    if (!Array.isArray(stages) || stages.length === 0)
      issues.push('Missing required field: stages');
    const jobEntries = Object.entries(parsedObj).filter(
=======
    if (!parsed.stages || parsed.stages.length === 0)
      issues.push('Missing required field: stages');
    const jobEntries = Object.entries<any>(parsed).filter(
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
      ([k]) => k !== 'stages',
    );
    if (jobEntries.length === 0) issues.push('No jobs defined');
    for (const [name, job] of jobEntries) {
<<<<<<< HEAD
      const script = toRecord(job).script;
      if (!(Array.isArray(script) ? script.length > 0 : Boolean(script)))
=======
      if (!job.script || job.script.length === 0)
>>>>>>> f987fd3d28c6e3e2f05dc33962aa3756bce27527
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
