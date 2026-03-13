import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import { HistoricalDelta } from '../../../../src/backend/models/HistoricalDelta';

function makeDelta(overrides?: Partial<HistoricalDelta>): HistoricalDelta {
  return {
    runAt: new Date().toISOString(),
    commit: null,
    testCount: 1,
    totalDuration: 1,
    averageDuration: 1,
    criticalPath: 1,
    balanceRatio: 1,
    ...overrides,
  };
}

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
        {
          name: 'A',
          duration: 1.2,
          status: 'passed',
          suiteStartupDuration: 0.04,
          suiteTeardownDuration: 0.01,
        },
        { name: 'B', duration: 2.2, status: 'passed' },
      ],
    };

    store.saveProfile(runId, profile);

    const filePath = path.join(tempDir, 'profiles', `${runId}.json`);
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(written).toEqual(profile);
  });

  it('keeps suite startup/teardown metadata when loading profiles', () => {
    const runId = 'run-profile-load';
    const profile = {
      testCount: 1,
      totalDuration: 1.2,
      averageDuration: 1.2,
      testResults: [
        {
          name: 'A',
          duration: 1.2,
          status: 'passed',
          suiteStartupDuration: 0.03,
          suiteTeardownDuration: 0.02,
        },
      ],
      metadata: {
        commit: null,
        generatedAt: null,
        cpuModel: 'unknown',
        cpuCores: 1,
        osVersion: 'unknown',
        platform: 'unknown',
        nodeVersion: 'unknown',
        containerVersion: 'unknown',
        memoryLimitMb: 1024,
      },
    };

    store.saveProfile(runId, profile);

    const loaded = store.loadProfiles();
    const loadedProfile = loaded.find((p) => p.testCount === 1);

    expect(loadedProfile?.testResults[0]).toMatchObject({
      name: 'A',
      suiteStartupDuration: 0.03,
      suiteTeardownDuration: 0.02,
    });
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

   it('saves and loads historical deltas', () => {
    store.saveHistoricalDeltas(makeDelta());
    store.saveHistoricalDeltas(makeDelta());

    const deltas = store.loadHistoricalDeltas(10);

    expect(deltas.length).toBe(2);
    expect(deltas[0]).toHaveProperty('deltas');
  });

  it('keeps only the most recent 50 delta files uncompressed', () => {
    for (let i = 0; i < 60; i++) {
      store.saveHistoricalDeltas(makeDelta());
    }

    const deltasDir = path.join(tempDir, 'history', 'deltas');
    expect(fs.existsSync(deltasDir)).toBe(true);

    const files = fs.readdirSync(deltasDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const gzFiles = files.filter(f => f.endsWith('.json.gz'));

    expect(jsonFiles.length).toBe(50);
    expect(gzFiles.length).toBe(10);
  });

  it('compresses older delta files using gzip', () => {
    for (let i = 0; i < 55; i++) {
      store.saveHistoricalDeltas(makeDelta());
    }

    const deltasDir = path.join(tempDir, 'history', 'deltas');
    const files = fs.readdirSync(deltasDir);
    const hasCompressed = files.some(f => f.endsWith('.json.gz'));

    expect(hasCompressed).toBe(true);
  });

  it('loads compressed delta files correctly', () => {
    for (let i = 0; i < 55; i++) {
      store.saveHistoricalDeltas(makeDelta());
    }

    const deltas = store.loadHistoricalDeltas(5);

    expect(deltas.length).toBe(5);
    expect(deltas[0]).toHaveProperty('deltas');
  });

  it('cleans up old archived delta files beyond the limit', () => {
    for (let i = 0; i < 600; i++) {
      store.saveHistoricalDeltas(makeDelta());
    }

    const deltasDir = path.join(tempDir, 'history', 'deltas');
    const gzFiles = fs.readdirSync(deltasDir)
      .filter(f => f.endsWith('.json.gz'));
      
    expect(gzFiles.length).toBeLessThanOrEqual(500);
  });
});
