#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as path from 'path';

import { TestSplitEngine } from '../core/TestSplitEngine';

const argv = yargs(hideBin(process.argv))
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
  })
  .option('out', {
    type: 'string',
    default: 'testsplit.yml',
  })
  .help()
  .parseSync();

const junitPath = path.resolve(argv.junit);
const jobCount = argv.jobs;

const engine = new TestSplitEngine();
const result = engine.run(junitPath, jobCount, false);

console.log(`Scheduled ${result.distribution.jobs.length} jobs`);
