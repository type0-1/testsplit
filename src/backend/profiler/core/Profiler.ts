import { TestResult } from '../../models/TestResult'
import { Profile } from '../model/Profile';
import { validateResults } from '../validation/ProfilerValidator';

export class Profiler {
  generateProfile(results: TestResult[]): Profile {
    validateResults(results);
    
    const testCount = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = testCount === 0 ? 0 : totalDuration / testCount;

    return {testResults: results, testCount, totalDuration, averageDuration};
  }
}
