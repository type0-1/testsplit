import { TestSplitEngine } from '../../../../src/backend/core/TestSplitEngine';

jest.mock('../../../../src/backend/parser/JUnitXMLParser');
jest.mock('../../../../src/backend/profiler/core/HistoricalProfiler');
jest.mock('../../../../src/backend/algorithm/core/LPTScheduler');
jest.mock('../../../../src/backend/storage/FileStore');
jest.mock('../../../../src/backend/helpers/RunId');

import { parseJUnitXML } from '../../../../src/backend/parser/JUnitXMLParser';
import { HistoricalProfiler } from '../../../../src/backend/profiler/core/HistoricalProfiler';
import { LPTScheduler } from '../../../../src/backend/algorithm/core/LPTScheduler';
import { FileStore } from '../../../../src/backend/storage/FileStore';
import { generateRunId } from '../../../../src/backend/helpers/RunId';

const mockParseJUnitXML = parseJUnitXML as jest.MockedFunction<typeof parseJUnitXML>;
const MockHistoricalProfiler = HistoricalProfiler as jest.MockedClass<typeof HistoricalProfiler>;
const MockLPTScheduler = LPTScheduler as jest.MockedClass<typeof LPTScheduler>;
const MockFileStore = FileStore as jest.MockedClass<typeof FileStore>;
const mockGenerateRunId = generateRunId as jest.MockedFunction<typeof generateRunId>;

const mockTestResults = [
  { name: 'TestA', duration: 1.0, status: 'passed' as const },
  { name: 'TestB', duration: 2.0, status: 'passed' as const },
];

const mockProfile = {
  schemaVersion: 1,
  testCount: 2,
  totalDuration: 3.0,
  averageDuration: 1.5,
  testResults: mockTestResults,
  metadata: {
    commit: null,
    generatedAt: '2026-01-01T00:00:00.000Z',
    cpuModel: 'mock-cpu',
    cpuCores: 4,
    osVersion: 'mock-os',
    platform: 'linux',
    nodeVersion: 'v20.0.0',
    containerVersion: 'none',
  },
};

const mockDistribution = {
  jobCount: 2,
  totalDuration: 3.0,
  jobs: [
    { jobId: 0, totalTime: 2.0, tasks: [{ id: 'TestB', duration: 2.0 }] },
    { jobId: 1, totalTime: 1.0, tasks: [{ id: 'TestA', duration: 1.0 }] },
  ],
  metrics: { balanceRatio: 0.5, maxJobTime: 2.0, minJobTime: 1.0 },
};

const mockHistoricalProfile = {
  runCount: 1,
  totalTests: 2,
  averageTestDuration: 1.5,
  testDurationVariance: 0.25,
  profiles: [mockProfile],
  perTestStats: {},
  metadata: [mockProfile.metadata],
};

describe('TestSplitEngine', () => {
  let mockProfilerInstance: jest.Mocked<HistoricalProfiler>;
  let mockSchedulerInstance: jest.Mocked<LPTScheduler>;
  let mockStoreInstance: jest.Mocked<FileStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStoreInstance = {
      loadProfiles: jest.fn().mockReturnValue([]),
      saveProfile: jest.fn(),
      saveDistribution: jest.fn(),
      saveHistoricalProfile: jest.fn(),
      saveHistoricalDeltas: jest.fn(),
      loadHistoricalDeltas: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<FileStore>;

    mockProfilerInstance = {
      addProfile: jest.fn(),
      generateProfile: jest.fn().mockReturnValue(mockProfile),
      generateHistoricalProfile: jest.fn().mockReturnValue(mockHistoricalProfile),
    } as unknown as jest.Mocked<HistoricalProfiler>;

    mockSchedulerInstance = {
      schedule: jest.fn().mockReturnValue(mockDistribution),
    } as unknown as jest.Mocked<LPTScheduler>;

    MockFileStore.mockImplementation(() => mockStoreInstance);
    MockHistoricalProfiler.mockImplementation(() => mockProfilerInstance);
    MockLPTScheduler.mockImplementation(() => mockSchedulerInstance);

    mockParseJUnitXML.mockReturnValue(mockTestResults);
    mockGenerateRunId.mockReturnValue('2026-01-01T00-00-00-000Z');
  });

  it('creates a FileStore with the provided baseDir', () => {
    new TestSplitEngine('/custom/dir');
    expect(MockFileStore).toHaveBeenCalledWith('/custom/dir');
  });

  describe('run()', () => {
    it('returns runId, profile, distribution, and historicalProfile', () => {
      const engine = new TestSplitEngine('/tmp/test');
      const result = engine.run('tests.xml', 2, false);

      expect(result.runId).toBe('2026-01-01T00-00-00-000Z');
      expect(result.profile).toEqual(mockProfile);
      expect(result.distribution).toEqual(mockDistribution);
      expect(result.historicalProfile).toEqual(mockHistoricalProfile);
    });

    it('loads previous profiles and adds them to the profiler before the current run', () => {
      const previousProfile = { ...mockProfile, testCount: 5 };
      mockStoreInstance.loadProfiles.mockReturnValue([previousProfile]);

      const engine = new TestSplitEngine('/tmp/test');
      engine.run('tests.xml', 2, false);

      const addCalls = mockProfilerInstance.addProfile.mock.calls.map(c => c[0]);
      expect(addCalls[0]).toEqual(previousProfile); // historical first
      expect(addCalls[1]).toEqual(mockProfile); // current run last
    });

    it('maps test results to tasks and schedules with the given job count', () => {
      const engine = new TestSplitEngine('/tmp/test');
      engine.run('tests.xml', 3, false);

      expect(mockSchedulerInstance.schedule).toHaveBeenCalledWith(
        [
          { id: 'TestA', duration: 1.0 },
          { id: 'TestB', duration: 2.0 },
        ],
        3,
      );
    });

    it('saves profile and distribution when persist=true', () => {
      const engine = new TestSplitEngine('/tmp/test');
      engine.run('tests.xml', 2, true);

      expect(mockStoreInstance.saveProfile).toHaveBeenCalledWith('2026-01-01T00-00-00-000Z', mockProfile);
      expect(mockStoreInstance.saveDistribution).toHaveBeenCalledWith('2026-01-01T00-00-00-000Z', mockDistribution);
    });

    it('does not save when persist=false', () => {
      const engine = new TestSplitEngine('/tmp/test');
      engine.run('tests.xml', 2, false);

      expect(mockStoreInstance.saveProfile).not.toHaveBeenCalled();
      expect(mockStoreInstance.saveDistribution).not.toHaveBeenCalled();
    });
  });
});
