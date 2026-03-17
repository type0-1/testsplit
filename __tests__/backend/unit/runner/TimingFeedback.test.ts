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

  it('returns empty array when results are empty', () => {
    expect(buildObservedTestResults([], [])).toEqual([]);
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

  it('does nothing when results are empty', () => {
    persistObservedTimings([], []);

    expect(mockSaveProfile).not.toHaveBeenCalled();
    expect(mockSaveHistoricalProfile).not.toHaveBeenCalled();
  });

  it('loads previous profiles before saving', () => {
    const jobs = [makeJob(1, [{ id: 'A', duration: 1 }])];
    const results = [makeResult(1, ['A'], 1000)];

    persistObservedTimings(results, jobs);

    expect(mockLoadProfiles).toHaveBeenCalledTimes(1);
  });
});
