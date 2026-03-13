import { parseJUnitXML } from '../parser/JUnitXMLParser';
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

  constructor(baseDir?: string){
    this.store = new FileStore(baseDir);
  }

  run(xmlPath: string, jobCount: number, persist: boolean, algorithm: Algorithm = 'lpt', riskFactor = 1.0) {
    const previousProfiles = this.store.loadProfiles();

    for (const profile of previousProfiles) {
      this.profiler.addProfile(profile);
    }

    const results = parseJUnitXML(xmlPath);
    const profile = this.profiler.generateProfile(results);
    this.profiler.addProfile(profile);

    const { perTestStats } = this.profiler.generateHistoricalProfile();

    const tasks: Task[] = profile.testResults.map(r => {
      const stats = perTestStats[r.name];
      const duration = stats ? stats.meanDuration + riskFactor * stats.stdDev : r.duration;
      return { id: r.name, duration };
    });

    const scheduler = algorithm === 'multifit' ? new MULTIFITScheduler() : new LPTScheduler();
    const distribution = scheduler.schedule(tasks, jobCount);
    const runId = generateRunId();

    if (persist) {
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
