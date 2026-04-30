#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  buildDockerfileCommand,
  handleDockerfileCommand,
} from './commands/docker-file';
import {
  buildProfileCommand,
  handleProfileCommand,
} from './commands/profile';
import {
  buildGenerateConfigCommand,
  handleGenerateConfigCommand,
} from './commands/generate-config';
import {
  buildCompareCommand,
  handleCompareCommand,
} from './commands/compare';
import {
  buildBenchmarkCommand,
  handleBenchmarkCommand,
} from './commands/benchmark';
import {
  buildValidateCommand,
  handleValidateCommand,
} from './commands/validate';
import { buildRunCommand, handleRunCommand } from './commands/run';
import {
  buildDashboardCommand,
  handleDashboardCommand,
} from './commands/dashboard';

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../..', 'package.json'), 'utf-8'),
) as { version: string };

function getCustomHelp(): string {
  const title = chalk.bold('testsplit');
  const version = `v${packageJson.version}`;
  const desc = 'Test distribution and scheduling engine for parallel CI/CD pipelines';

  const commands = [
    { name: 'profile', desc: 'Profile tests and display scheduling metrics' },
    {
      name: 'generate-config',
      desc: 'Generate CI configuration from test profile',
    },
    {
      name: 'dockerfile',
      desc: 'Generate a Dockerfile for a Maven/Java project',
    },
    { name: 'run', desc: 'Schedule and execute test subsets in parallel' },
    {
      name: 'benchmark',
      desc: 'Run benchmark report (sequential -> parallel -> delta)',
    },
    {
      name: 'compare',
      desc: 'Compare recent profiling runs and detect regressions',
    },
    {
      name: 'validate',
      desc: 'Validate a generated CI configuration file',
    },
    {
      name: 'dashboard',
      desc: 'Start API + frontend dashboard and open in browser',
    },
  ];

  let output = `\n${title} ${chalk.dim(version)}\n${desc}\n\n`;
  output += chalk.bold('Usage:\n');
  output += '  testsplit <command> [options]\n\n';

  output += chalk.bold('Commands:\n');
  const maxLen = Math.max(...commands.map((c) => c.name.length));
  commands.forEach((cmd) => { output += `  ${cmd.name.padEnd(maxLen)}  ${cmd.desc}\n` });

  output += `\n${chalk.bold('Global Options:')}\n`;
  output += '  --help        Show this help message\n';
  output += '  --version     Show version number\n\n';
  output += chalk.dim(
    "Run 'testsplit <command> --help' for command-specific options\n",
  );

  return output;
}

const args = hideBin(process.argv);
if (args.includes('--help') || args.includes('-h')) {
  if (
    args.length === 1 ||
    (args.length === 2 && (args[0] === '--help' || args[0] === '-h'))
  ) {
    console.log(getCustomHelp());
    process.exit(0);
  }
}

yargs(args)
  .command(
    'profile',
    'Profile tests and display scheduling metrics',
    buildProfileCommand,
    handleProfileCommand,
  )
  .command(
    'generate-config',
    'Generate CI configuration from test profile',
    buildGenerateConfigCommand,
    handleGenerateConfigCommand,
  )
  .command(
    'compare',
    'Compare recent profiling runs and detect regressions',
    buildCompareCommand,
    handleCompareCommand,
  )
  .command(
    'benchmark',
    'Run benchmark report (sequential -> parallel -> delta)',
    buildBenchmarkCommand,
    handleBenchmarkCommand,
  )
  .command(
    'validate',
    'Validate a generated CI configuration file',
    buildValidateCommand,
    handleValidateCommand,
  )
  .command(
    'run',
    'Schedule and execute test subsets in parallel, recording real wall-clock time per job',
    buildRunCommand,
    handleRunCommand,
  )
  .command(
    'dockerfile',
    'Generate a Dockerfile for a Maven/Java project',
    buildDockerfileCommand,
    handleDockerfileCommand,
  )
  .command(
    'dashboard',
    'Start the TestSplit dashboard (builds frontend if needed, then opens in browser)',
    buildDashboardCommand,
    handleDashboardCommand,
  )
  .version(packageJson.version)
  .alias('h', 'help')
  .demandCommand()
  .help()
  .parse();
