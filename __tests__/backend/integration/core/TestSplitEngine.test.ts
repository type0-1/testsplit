import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('TestSplitEngine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-engine-')); // isolated temp dir for test
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs parser, profiler, scheduler and persists results', () => {
    const engine = new TestSplitEngine(tempDir);
    const xmlPath = path.join(__dirname, 'fixtures', 'basic.xml');
    const result = engine.run(xmlPath, 2, true);

    expect(result.profile.testCount).toBeGreaterThan(0);
    expect(result.distribution.jobs.length).toBe(2);
    expect(result.runId).toBeDefined();

    const profilePath = path.join(tempDir, 'profiles', `${result.runId}.json`);
    const distributionPath = path.join(tempDir, 'distributions', `${result.runId}.json`);
    const raw = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    
    expect(fs.existsSync(profilePath)).toBe(true);
    expect(fs.existsSync(distributionPath)).toBe(true);
    expect(raw.metadata).toBeDefined();
    expect(raw.metadata.generatedAt).toBeDefined();

  });
});
