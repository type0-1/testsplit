import { JUnitXMLParser } from '../parser/JUnitXMLParser';
import { TestResultParser } from '../parser/TestResultParser';
import { HistoricalProfiler } from '../profiler/core/HistoricalProfiler'
import { LPTScheduler } from '../algorithm/core/LPTScheduler';
import { MULTIFITScheduler } from '../algorithm/core/MULTIFITScheduler';
import { Task } from '../algorithm/model/Task';
import { FileStore } from '../storage/FileStore';
import { generateRunId } from '../helpers/RunId'

export type Algorithm = 'lpt' | 'multifit';

export class TestSplitEngine {
  private profiler = new HistoricalProfiler();
  private store: FileStore;
  private parser: TestResultParser;

  constructor(baseDir?: string, parser: TestResultParser = new JUnitXMLParser()){
    this.store = new FileStore(baseDir);
    this.parser = parser;
  }

  run(
    xmlPath: string,
    jobCount: number,
    persist: boolean,
    algorithm: Algorithm = 'lpt',
    riskFactor = 1.0,
    dependencyMap?: Map<string, string[]>
  ) {
    const previousProfiles = this.store.loadProfiles();

    for (const profile of previousProfiles) {
      this.profiler.addProfile(profile);
    }

    const results = this.parser.parse(xmlPath);
    const profile = this.profiler.generateProfile(results);
    this.profiler.addProfile(profile);

    const { perTestStats } = this.profiler.generateHistoricalProfile();

    /**
     * Aggregate durations by class name before scheduling. The CI generator
     * emits -Dtest=ClassName so per-method task granularity adds no scheduling
     * value and is prohibitively expensive for suites with large parameterised test counts.
     */

    const classMap = new Map<string, number>();

    for (const r of profile.testResults) {
      const className = r.name.includes('#') ? r.name.split('#')[0] : r.name.split('.').slice(0, -1).join('.') || r.name;
      const stats = perTestStats[r.name];
      const duration = stats ? stats.meanDuration + riskFactor * stats.stdDev : r.duration;
      classMap.set(className, (classMap.get(className) ?? 0) + duration);
    }

    const taskMap = new Map<string, Task>();
    for (const [className, duration] of classMap) {
      const dependencies = dependencyMap?.get(className);
      taskMap.set(className, { id: className, duration, ...(dependencies ? { dependencies } : {}) });
    }

    const tasks: Task[] = [...taskMap.values()];
    const scheduler = algorithm === 'multifit' ? new MULTIFITScheduler() : new LPTScheduler();
    const distribution = scheduler.schedule(tasks, jobCount);
    const runId = generateRunId();
    const MAX_PERSIST_TESTS = 100_000;
    
    if (persist && profile.testCount <= MAX_PERSIST_TESTS) {
      this.store.saveProfile(runId, profile);
      this.store.saveDistribution(runId, distribution);
      this.store.saveHistoricalProfile(this.profiler.generateHistoricalProfile());
    }

    return {
      runId,
      profile,
      distribution,
      historicalProfile: this.profiler.generateHistoricalProfile()
    };
  }
}
