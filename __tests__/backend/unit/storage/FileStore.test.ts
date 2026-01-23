import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../../../../src/backend/storage/FileStore';

describe('FileStore', () => {
  let tempDir: string;
  let store: FileStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsplit-'));
    store = new FileStore(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true }); // clean temp dir's
  });

  it('creates storage directories on initialisation', () => {
    expect(fs.existsSync(path.join(tempDir, 'profiles'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'distributions'))).toBe(true);
  });

  it('writes a profile JSON file correctly', () => {
    const runId = 'run-profile';
    const profile = {
      testCount: 2,
      totalDuration: 3.4,
      testResults: [
        { name: 'A', duration: 1.2, status: 'passed' },
        { name: 'B', duration: 2.2, status: 'passed' },
      ],
    };

    store.saveProfile(runId, profile);

    const filePath = path.join(tempDir, 'profiles', `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written).toEqual(profile);
  });

  it('writes a job distribution JSON file correctly', () => {
    const runId = 'run-distribution';
    const distribution = {
      jobCount: 2,
      totalDuration: 10,
      jobs: [
        { jobId: 0, totalTime: 4, tasks: [] },
        { jobId: 1, totalTime: 6, tasks: [] },
      ],
      metrics: {
        balanceRatio: 0.67,
        maxJobTime: 6,
        minJobTime: 4,
      },
    };

    store.saveDistribution(runId, distribution);

    const filePath = path.join(tempDir, 'distributions', `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // check for storage
    expect(written.schemaVersion).toBe(1);
    expect(written.runId).toBe(runId);
    expect(typeof written.createdAt).toBe('string');

    // checking the payload that it is the same
    expect(written.distribution).toEqual(distribution);
  });

  it('writes a historical profile JSON file correctly', () => {
    const historicalProfile = {
      runCount: 3,
      totalTests: 12,
      averageTestDuration: 1.8,
      testDurationVariance: 0.42,
      profiles: [
        { testCount: 4, totalDuration: 6, averageDuration: 1.5, testResults: [] },
        { testCount: 4, totalDuration: 7, averageDuration: 1.75, testResults: [] },
        { testCount: 4, totalDuration: 8, averageDuration: 2.0, testResults: [] },
      ],
    };

    store.saveHistoricalProfile(historicalProfile);

    const filePath = path.join(tempDir, 'profiles', 'historical.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written).toEqual(historicalProfile);
  });

});
