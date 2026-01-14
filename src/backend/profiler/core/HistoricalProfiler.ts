import { Profiler } from './Profiler';
import { Profile } from '../model/Profile';
import { TestResult } from '../../models/TestResult';

export interface TestHistoricalStats {
  runCount: number;
  meanDuration: number;
  variance: number;
}
export interface HistoricalProfile {
  runCount: number;
  totalTests: number;
  averageTestDuration: number;
  testDurationVariance: number;
  profiles: Profile[];
  perTestStats: Record<string, TestHistoricalStats>
}

export class HistoricalProfiler extends Profiler {
  private profiles: Profile[] = [];

  private buildTestDurationMap(profiles: Profile[]): Record<string, number[]> {
      const map: Record<string, number[]> = {};

      for (const profile of profiles) {
        for (const result of profile.testResults) {
          if (!map[result.name]) {
            map[result.name] = [];
          }
          map[result.name].push(result.duration);
        }
      }

      return map;
  }

  private computePerTestStats(testDurationMap: Record<string, number[]>): Record<string, TestHistoricalStats> {
    const stats: Record<string, TestHistoricalStats> = {};

    for (const [testName, durations] of Object.entries(testDurationMap)) {
      const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;

      stats[testName] = {
        runCount: durations.length,
        meanDuration: mean,
        variance,
      };
      
    }

    return stats;
  }

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
    const testDurationMap = this.buildTestDurationMap(this.profiles);
    const perTestStats = this.computePerTestStats(testDurationMap);

    return {
      runCount,
      totalTests,
      averageTestDuration: mean,
      testDurationVariance: variance,
      profiles: this.profiles,
      perTestStats,
    };
  }

  reset(): void {
    this.profiles = [];
  }
}
