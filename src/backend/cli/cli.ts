#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { TestSplitEngine } from '../core/TestSplitEngine';
import { generateGitHubActionsConfig } from '../generator/GitHubActionsGenerator';
import { generateGitLabCIConfig } from '../generator/GitLabCIGenerator';
import { Task } from '../algorithm/model/Task';

type Platform = 'github' | 'gitlab';

const argv = yargs(hideBin(process.argv))
  .option('junit', {
    type: 'string',
    demandOption: true,
  })
  .option('jobs', {
    type: 'number',
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
const platform = argv.platform as Platform;
const outPath = path.resolve(argv.out);

const engine = new TestSplitEngine();
const result = engine.run(junitPath, jobCount, false);

const jobs = result.distribution.jobs.map((job, index: number) => ({
  id: index + 1,
  tests: job.tasks.map((t: Task) => t.id),
}));

const ciConfig =
  platform === 'github'
    ? generateGitHubActionsConfig(jobs)
    : generateGitLabCIConfig(jobs);

fs.writeFileSync(outPath, ciConfig, 'utf-8');

console.log(`CI configuration written to ${outPath}`);
