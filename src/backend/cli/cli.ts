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

yargs(hideBin(process.argv))
  .command('profile', 'Profile tests and display scheduling metrics', y => y
    .option('junit', {
      type: 'string',
      demandOption: true,
      describe: 'Path to JUnit XML file or directory'
    })
    .option('jobs', {
      type: 'number',
      default: 2,
      describe: 'Number of parallel jobs'
    }),
    argv => {
      const junitPath = path.resolve(argv.junit as string);
      const jobCount = argv.jobs as number;
      const engine = new TestSplitEngine();
      const { profile, distribution } = engine.run(junitPath, jobCount, false);
      const m = distribution.metrics;

      console.log('\nTestSplit Profile Summary\n');
      console.log(`Tests parsed:       ${profile.testCount}`);
      console.log(`Total duration:     ${profile.totalDuration.toFixed(2)}s`);
      console.log(`Parallel jobs:      ${distribution.jobCount}`);
      console.log(`Critical path:      ${m.criticalPath.toFixed(2)}s`);
      console.log(`Predicted speed-up: ${m.predictedSpeedUp.toFixed(2)}×`);
      console.log(`Balance ratio:      ${m.balanceRatio.toFixed(2)}\n`);
    }
  )
  .command('generate-config', 'Generate CI configuration from test profile', y => y
    .option('junit', {
      type: 'string',
      demandOption: true,
      describe: 'Path to JUnit XML file or directory'
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
    }),
    argv => {
      const junitPath = path.resolve(argv.junit as string);
      const jobCount = argv.jobs as number;
      const platform = argv.platform as Platform;
      const outPath = path.resolve(argv.out as string);
      const engine = new TestSplitEngine();
      const result = engine.run(junitPath, jobCount, false);
  
      const jobs = result.distribution.jobs.map((job, index) => ({
        id: index + 1,
        tests: job.tasks.map((t: Task) => t.id),
      }));

      const ciConfig =
        platform === 'github'
          ? generateGitHubActionsConfig(jobs)
          : generateGitLabCIConfig(jobs);

      fs.writeFileSync(outPath, ciConfig, 'utf-8');
      console.log(`CI configuration written to ${outPath}`);
    }
  )
  .demandCommand()
  .help()
  .parse();
