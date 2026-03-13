import { CommitInfo, CommitTracker } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';
import { Profile } from '../model/Profile';
import { validateResults } from '../validation/ProfilerValidator';
import { ProfileMetadata, ProfileGroupings } from '../model/Profile';
import { PROFILE_SCHEMA_VERSION } from '../../storage/SchemaVersions';
import os from 'os';
export class Profiler {
  generateProfile(results: TestResult[], commit?: CommitInfo): Profile {
    validateResults(results);

    const testCount = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = testCount === 0 ? 0 : totalDuration / testCount;

    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      testResults: results,
      testCount,
      totalDuration,
      averageDuration,
      metadata: this.collectMetadata(results, commit),
    };
  }

  private collectMetadata(results: TestResult[], commit?: CommitInfo): ProfileMetadata {
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
    const grouped: Record<string, { testCount: number; totalDuration: number }> = {};

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
