import { parseJUnitXML } from '../parser/JUnitXMLParser';
import { HistoricalProfiler } from '../profiler/core/HistoricalProfiler'
import { LPTScheduler } from '../algorithm/core/LPTScheduler';
import { Task } from '../algorithm/model/Task';
import { FileStore } from '../storage/FileStore';
import { generateRunId } from '../helpers/RunId'
export class TestSplitEngine {
  private profiler = new HistoricalProfiler();
  private scheduler = new LPTScheduler();
  private store: FileStore;

  constructor(baseDir?: string){
    this.store = new FileStore(baseDir);
  }

  run(xmlPath: string, jobCount: number, persist: boolean) {
    const previousProfiles = this.store.loadProfiles();

    for (const profile of previousProfiles) {
      this.profiler.addProfile(profile);
    }

    const results = parseJUnitXML(xmlPath);
    const profile = this.profiler.generateProfile(results);
    this.profiler.addProfile(profile);

    const tasks: Task[] = profile.testResults.map(r => ({
      id: r.name,
      duration: r.duration
    }));

    const distribution = this.scheduler.schedule(tasks, jobCount);
    const runId = generateRunId();

    if (persist) {
      this.store.saveProfile(runId, profile);
      this.store.saveDistribution(runId, distribution);
    }

    return {
      runId,
      profile,
      distribution,
      historicalProfile: this.profiler.generateHistoricalProfile()
    };
  }
}
