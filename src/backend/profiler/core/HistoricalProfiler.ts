import { Profiler } from './Profiler';
import { Profile } from '../model/Profile';
import { TestResult } from '../../models/TestResult';

export interface HistoricalProfile {
  runCount: number;
  totalTests: number;
  averageTestDuration: number;
  testDurationVariance: number;
  profiles: Profile[];
}

export class HistoricalProfiler extends Profiler {
  private profiles: Profile[] = [];

  addRun(results: TestResult[]): Profile {
    const profile = this.generateProfile(results);
    this.profiles.push(profile);
    return profile;
  }


  generateHistoricalProfile(): HistoricalProfile {
    if (this.profiles.length === 0) {
      throw new Error('No profiling runs available');
    }

    const runCount = this.profiles.length;
    const totalTests = this.profiles.reduce((sum, p) => sum + p.testCount, 0);
    const allDurations = this.profiles.flatMap(p => p.testResults.map(r => r.duration));
    const mean = allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    const variance = allDurations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / allDurations.length;

    return {
      runCount,
      totalTests,
      averageTestDuration: mean,
      testDurationVariance: variance,
      profiles: this.profiles,
    };
  }

  reset(): void {
    this.profiles = [];
  }
}
