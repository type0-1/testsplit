import * as fs from 'fs';
import * as os from 'os';
import chalk from 'chalk';
import { EXIT_FAILURE } from '../constants';

export function normalizeJobs(input: unknown): number {
  let jobCount = Number(input);

  if (!Number.isInteger(jobCount) || jobCount <= 0) {
    console.error(chalk.red('Error: --jobs must be a positive integer'));
    process.exit(EXIT_FAILURE);
  }

  const availableCores = os.cpus().length;
  if (jobCount > availableCores) {
    console.warn(
      chalk.yellow(
        `Warning: --jobs ${jobCount} exceeds available cores (${availableCores}). Capping to ${availableCores}.`,
      ),
    );
    jobCount = availableCores;
  }

  return jobCount;
}

export function normalizeRiskFactor(input: unknown): number {
  const riskFactor = Number(input);
  if (!Number.isFinite(riskFactor) || riskFactor < 0) {
    console.error(
      chalk.red('Error: --risk-factor must be a non-negative number'),
    );
    process.exit(EXIT_FAILURE);
  }

  return riskFactor;
}

export function assertJUnitPathExists(junitPath: string): void {
  if (!fs.existsSync(junitPath)) {
    console.error(chalk.red(`Error: JUnit path does not exist: ${junitPath}`));
    process.exit(EXIT_FAILURE);
  }
}
