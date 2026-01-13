#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .option('junit', {
    type: 'string',
    describe: 'Path to JUnit XML report',
    demandOption: true,
  })
  .option('jobs', {
    type: 'number',
    describe: 'Number of parallel jobs',
    default: 2,
  })
  .option('platform', {
    type: 'string',
    choices: ['github', 'gitlab'],
    default: 'github',
    describe: 'CI platform',
  })
  .option('out', {
    type: 'string',
    describe: 'Output file for CI config',
    default: 'testsplit.yml',
  })
  .help()
  .parse();
