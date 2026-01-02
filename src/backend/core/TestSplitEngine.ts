import { parseJUnitXML } from '../parser/JUnitXMLParser';
import { Profiler } from '../profiler/core/Profiler';
import { LPTScheduler } from '../algorithm/core/LPTScheduler';
import { Task } from '../algorithm/model/Task';
import { FileStore } from '../storage/FileStore';
import { generateRunId } from '../helpers/RunId'
export class TestSplitEngine {
  private profiler = new Profiler();
  private scheduler = new LPTScheduler();
  private store = new FileStore();

  constructor(baseDir?: string){
    this.store = new FileStore(baseDir);
  }

  run(xmlPath: string, jobCount: number, persist: boolean) {
    const results = parseJUnitXML(xmlPath);
    const profile = this.profiler.generateProfile(results);
    const tasks: Task[] = profile.testResults.map(r => ({id: r.name, duration: r.duration})); // Map tasks to profiler
    const distribution = this.scheduler.schedule(tasks, jobCount); // Schedule tasks
    const runId = generateRunId();

    if(persist){
      this.store.saveProfile(runId, profile)
      this.store.saveDistribution(runId, distribution)
    }

    return { runId, profile, distribution };
  }
}
