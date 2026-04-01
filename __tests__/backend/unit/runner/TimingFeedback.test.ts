const mockSaveProfile = jest.fn();
const mockSaveHistoricalProfile = jest.fn();
const mockLoadProfiles = jest.fn().mockReturnValue([]);
jest.mock('../../../../src/backend/storage/FileStore', () => ({
  FileStore: jest.fn().mockImplementation(() => ({
    saveProfile: mockSaveProfile,
    saveHistoricalProfile: mockSaveHistoricalProfile,
    loadProfiles: mockLoadProfiles,
  })),
}));

jest.mock('../../../../src/backend/profiler/core/HistoricalProfiler', () => ({
  HistoricalProfiler: jest.fn().mockImplementation(() => ({
    addProfile: jest.fn(),
    generateProfile: jest.fn(() => ({ id: 'run-profile' })),
    generateHistoricalProfile: jest.fn(() => ({ id: 'historical-profile' })),
  })),
}));

jest.mock('../../../../src/backend/helpers/RunId', () => ({
  generateRunId: jest.fn(() => 'test-run-id'),
}));

import { buildObservedTestResults, persistObservedTimings } from '../../../../src/backend/runner/TimingFeedback';
import { Job } from '../../../../src/backend/algorithm/model/Job';
import { JobResult } from '../../../../src/backend/runner/ParallelRunner';

beforeEach(() => jest.clearAllMocks());

function makeJob(jobId: number, tasks: { id: string; duration: number }[]): Job {
  const job = new Job(jobId);
  tasks.forEach((t) => job.addTask(t));
  return job;
}

function makeResult(jobId: number, testNames: string[], wallClockMs: number, exitCode = 0): JobResult {
  return { jobId, testNames, wallClockMs, exitCode, stdout: '', stderr: '' };
}

describe('buildObservedTestResults', () => {
  it('distributes wall-clock time proportionally by scheduled duration', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }, { id: 'B', duration: 3 }])];
    const results = [makeResult(1, ['A', 'B'], 4000)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed).toHaveLength(2);
    const a = observed.find((r) => r.name === 'A')!;
    const b = observed.find((r) => r.name === 'B')!;
    // A has 1/4 weight, B has 3/4 weight; total wallClock = 4s
    expect(a.duration).toBeCloseTo(1.0);
    expect(b.duration).toBeCloseTo(3.0);
  });

  it('splits equally when all scheduled durations are zero', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 0 }, { id: 'B', duration: 0 }])];
    const results = [makeResult(1, ['A', 'B'], 2000)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed[0].duration).toBeCloseTo(1.0);
    expect(observed[1].duration).toBeCloseTo(1.0);
  });

  it('converts wallClockMs to seconds', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 5000)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed[0].duration).toBeCloseTo(5.0);
  });

  it('marks tests as passed when exitCode is 0', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000, 0)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed[0].status).toBe('passed');
  });

  it('marks tests as failed when exitCode is non-zero', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000, 1)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed[0].status).toBe('failed');
  });

  it('handles multiple jobs correctly', () => {
    const jobs = [
      makeJob(1, [{ id: 'A', duration: 2 }]),
      makeJob(2, [{ id: 'B', duration: 4 }]),
    ];
    const results = [
      makeResult(1, ['A'], 2000),
      makeResult(2, ['B'], 4000),
    ];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed).toHaveLength(2);
    expect(observed.find((r) => r.name === 'A')!.duration).toBeCloseTo(2.0);
    expect(observed.find((r) => r.name === 'B')!.duration).toBeCloseTo(4.0);
  });

  it('defaults to zero duration when test name not found in scheduled durations', () => {
    // Job defines A with duration 3, but result includes both A and unknown test B
    const jobs = [makeJob(1, [{ id: 'A', duration: 3 }])];
    const results = [makeResult(1, ['A', 'B'], 6000)];

    const observed = buildObservedTestResults(results, jobs);

    // A has weight 3/3 = 1.0, B has weight 0/3 = 0.0
    expect(observed).toHaveLength(2);
    const a = observed.find((r) => r.name === 'A')!;
    const b = observed.find((r) => r.name === 'B')!;
    expect(a.duration).toBeCloseTo(6.0);
    expect(b.duration).toBeCloseTo(0.0);
  });

  it('handles empty test names array', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, [], 1000)];

    const observed = buildObservedTestResults(results, jobs);

    expect(observed).toHaveLength(0);
  });

});

describe('persistObservedTimings', () => {
  it('saves profile and historical profile to the store', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }, { id: 'B', duration: 2 }])];
    const results = [makeResult(1, ['A', 'B'], 3000)];

    persistObservedTimings(results, jobs);

    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
    expect(mockSaveHistoricalProfile).toHaveBeenCalledTimes(1);
  });

  it('loads previous profiles before saving', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000)];

    persistObservedTimings(results, jobs);

    expect(mockLoadProfiles).toHaveBeenCalledTimes(1);
  });

  it('returns early when observed results list is empty', () => {
    // Job doesn't have any tasks, so buildObservedTestResults returns empty
    const jobs = [new Job(1)];
    const results = [makeResult(1, [], 1000)];

    persistObservedTimings(results, jobs);

    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(mockSaveHistoricalProfile).not.toHaveBeenCalled();
  });

  it('passes baseDir to FileStore constructor', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000)];
    const customBaseDir = '/custom/path';
    
    // Mock loadProfiles to return an empty array
    mockLoadProfiles.mockReturnValue([]);

    persistObservedTimings(results, jobs, customBaseDir);

    const FileStore = require('../../../../src/backend/storage/FileStore').FileStore;
    expect(FileStore).toHaveBeenCalledWith(customBaseDir);
  });

  it('loads and merges multiple profiles before saving', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000)];
    
    // Mock loadProfiles to return multiple profiles
    const mockProfile1 = { id: 'profile-1', tests: {} };
    const mockProfile2 = { id: 'profile-2', tests: {} };
    mockLoadProfiles.mockReturnValue([mockProfile1, mockProfile2]);

    persistObservedTimings(results, jobs);

    // Verify loadProfiles was called
    expect(mockLoadProfiles).toHaveBeenCalled();
    expect(mockSaveProfile).toHaveBeenCalledTimes(1);
    expect(mockSaveHistoricalProfile).toHaveBeenCalledTimes(1);
  });
});
