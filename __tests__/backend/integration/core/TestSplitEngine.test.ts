import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import * as path from 'path';

describe('TestSplitEngine', () => {
  it('runs parser, profiler and scheduler end-to-end', () => {
    const engine = new TestSplitEngine();
    const xmlPath = path.join(__dirname, 'fixtures', 'basic.xml');
    const result = engine.run(xmlPath, 2);

    expect(result.profile.testCount).toBeGreaterThan(0);
    expect(result.distribution.jobs.length).toBe(2);
  });
});
