import { CommitInfo } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';
import { Profile } from '../model/Profile';
import { validateResults } from '../validation/ProfilerValidator';
import { ProfileMetadata, ProfileGroupings } from '../model/Profile';
import {
  validateResults,
  flagZeroDurationTests,
  detectOutlierTests,
  validateCommitPresence,
} from '../validation/ProfilerValidator';
import { PROFILE_SCHEMA_VERSION } from '../../storage/SchemaVersions';
import { EnvironmentCollector } from './EnvironmentCollector';

export class Profiler {
  generateProfile(results: TestResult[], commit?: CommitInfo): Profile {
    validateResults(results);

    const zeroDuration = flagZeroDurationTests(results);

    if (zeroDuration.length > 0) {
      console.warn(
        `Warning: ${zeroDuration.length} test(s) reported zero duration`,
      );
    }

    const outliers = detectOutlierTests(results);

    if (outliers.length > 0) {
      console.warn(
        `Warning: ${outliers.length} test(s) have outlier durations within this run: ${outliers.join(', ')}`,
      );
    }

    const testCount = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = testCount === 0 ? 0 : totalDuration / testCount;
    const metadata = EnvironmentCollector.collect(commit);

    validateCommitPresence(metadata);

    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      testResults: results,
      testCount,
      totalDuration,
      averageDuration,
      metadata: this.collectMetadata(results, commit),
    };
  }

  private collectMetadata(
    results: TestResult[],
    commit?: CommitInfo,
  ): ProfileMetadata {
    return {
      commit: commit ?? CommitTracker.getCurrentCommit(),
      generatedAt: new Date().toISOString(),

      cpuModel: os.cpus()[0]?.model ?? 'unknown',
      cpuCores: os.cpus().length,
      osVersion: typeof os.version === 'function' ? os.version() : 'unknown',
      platform: os.platform(),
      nodeVersion: process.version,
      containerVersion: process.env.CONTAINER_VERSION ?? 'unknown',
      memoryLimitMb: Math.round(os.totalmem() / (1024 * 1024)),
      groupings: this.buildGroupings(results),
      metadata,
    };
  }

  private buildGroupings(results: TestResult[]): ProfileGroupings {
    return {
      byFilePath: this.groupBy(results, (r) => r.filePath),
      byPackage: this.groupBy(results, (r) => r.packageName),
      byClassName: this.groupBy(results, (r) => r.className),
    };
  }

  private groupBy(
    results: TestResult[],
    getKey: (result: TestResult) => string | undefined,
  ): Record<string, { testCount: number; totalDuration: number }> {
    const grouped: Record<
      string,
      { testCount: number; totalDuration: number }
    > = {};

    for (const result of results) {
      const key = getKey(result) ?? 'unknown';
      if (!grouped[key]) {
        grouped[key] = { testCount: 0, totalDuration: 0 };
      }

      grouped[key].testCount += 1;
      grouped[key].totalDuration += result.duration;
    }

    return grouped;
  }
}
