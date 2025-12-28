import { parseJUnitXML } from '../parser/JUnitXMLParser';
import { Profiler } from '../profiler/core/Profiler';
import { LPTScheduler } from '../algorithm/core/LPTScheduler';
import { Task } from '../algorithm/model/Task';

export class TestSplitEngine {
  private profiler = new Profiler();
  private scheduler = new LPTScheduler();

  run(xmlPath: string, jobCount: number) {
    const results = parseJUnitXML(xmlPath);
    const profile = this.profiler.generateProfile(results);
    const tasks: Task[] = profile.testResults.map(r => ({id: r.name, duration: r.duration})); // Map tasks to profiler
    const distribution = this.scheduler.schedule(tasks, jobCount); // Schedule tasks

    return { profile, distribution };
  }
}
