import * as path from 'path';
import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import { generateGitHubActionsConfig } from '../../../../src/backend/generator/GitHubActionsGenerator';

describe('End-to-end test split', () => {
  it('parses, profiles, schedules and generates CI config', () => {
    const junitPath = path.join(__dirname, 'fixtures', 'basic.xml');

    const engine = new TestSplitEngine();

    const result = engine.run(junitPath, 2, false);

    expect(result.distribution.jobs.length).toBe(2);

    const jobs = result.distribution.jobs.map((job, index) => ({
      id: index + 1,
      tests: job.tasks.map((t) => t.id),
    }));

    const ciConfig = generateGitHubActionsConfig(jobs);

    expect(ciConfig).toContain('job-1');
    expect(ciConfig).toContain('job-2');
  });
});
