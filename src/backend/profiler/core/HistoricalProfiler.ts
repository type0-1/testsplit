import { Profiler } from './Profiler';
import { Profile } from '../model/Profile';
import { TestResult } from '../../models/TestResult';
import { HistoricalProfile } from '../../models/HistoricalProfile';
import { HistoricalTestStats } from '../../models/HistoricalTestStats';
import { computeOutlierThreshold } from '../../utils/stats';

/**
 * References:
 *  Smoothing Factor inspired by Forecasting: Principles and Practices (https://robjhyndman.com/uwafiles/fpp-notes.pdf)
 *  - We use the smoothing factor (page 35) uses the following formula: (alpha*curr_value) + ((1-alpha)*prev_smoothed_val)), 
 *  0.6 is not the final value, but just used to give more weignt to recent runs while considering historical data.
 * 
 *  Instability Threshold inspired by Coefficient of Variation (https://personal.utdallas.edu/~herve/abdi-cv2010-pretty.pdf)
 * - We consider a test unstable if its coefficient of variation exceeds 0.5, indicating that the std is half the mean, meaning test dur. is highly relative to its avg.
 *
 *  Outlier Detection: see computeOutlierThreshold in utils/stats.ts
 */
export class HistoricalProfiler extends Profiler {
  private static readonly INSTABILITY_THRESHOLD = 0.5;
  private static readonly SMOOTHING_FACTOR = 0.6;
  private profiles: Profile[] = [];

  addProfile(profile: Profile): void {
    this.profiles.push(profile);
  }

  addProfiles(profiles: Profile[]): void {
    for (const p of profiles) {
      this.addProfile(p);
    }
  }

  setProfiles(profiles: Profile[]): void {
    this.profiles = [...profiles];
  }

  getProfiles(): Profile[] {
    return [...this.profiles];
  }

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

  private computePerTestStats(
    testDurationMap: Record<string, number[]>,
  ): Record<string, HistoricalTestStats> {
    const stats: Record<string, HistoricalTestStats> = {};

    for (const [testName, durations] of Object.entries(testDurationMap)) {
      const runCount = durations.length;
      const mean =
        runCount === 0
          ? 0
          : durations.reduce((sum, d) => sum + d, 0) / runCount;
      let smoothedMean = mean;

      if (runCount > 1) {
        const previousMean =
          durations.slice(0, -1).reduce((sum, d) => sum + d, 0) /
          (runCount - 1);

        smoothedMean =
          HistoricalProfiler.SMOOTHING_FACTOR * mean +
          (1 - HistoricalProfiler.SMOOTHING_FACTOR) * previousMean;
      }

      const variance = runCount === 0 ? 0 : durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / runCount;
      const stdDev = Math.sqrt(variance);
      const min = runCount === 0 ? 0 : Math.min(...durations);
      const max = runCount === 0 ? 0 : Math.max(...durations);
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
      const unstable = coefficientOfVariation > HistoricalProfiler.INSTABILITY_THRESHOLD;
      const zeroDuration = durations.some((d) => d === 0);

      stats[testName] = {
        testName,
        runCount,
        meanDuration: smoothedMean,
        variance,
        stdDev,
        min,
        max,
        coefficientOfVariation,
        unstable,
        zeroDuration,
        isOutlier: false,
      };
    }

    const means = Object.values(stats).map((s) => s.meanDuration);
    if (means.length > 1) {
      const outlierThreshold = computeOutlierThreshold(means);

      for (const s of Object.values(stats)) {
        s.isOutlier = s.meanDuration > outlierThreshold;
      }
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
    const allDurations = this.profiles.flatMap((p) =>
      p.testResults.map((r) => r.duration),
    );
    const averageTestDuration = allDurations.length === 0 ? 0: allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    const testDurationVariance =
      allDurations.length === 0 ? 0 : allDurations.reduce((sum, d) => sum + Math.pow(d - averageTestDuration, 2), 0,) / allDurations.length;
    const testDurationMap = this.buildTestDurationMap(this.profiles);
    const perTestStats = this.computePerTestStats(testDurationMap);
    const metadata = this.profiles.map(p => p.metadata);

    return {
      runCount,
      totalTests,
      averageTestDuration,
      testDurationVariance,
      profiles: this.getProfiles(),
      perTestStats,
      metadata,
    };
  }

  reset(): void {
    this.profiles = [];
  }
}
