import os from 'os';
import fs from 'fs';
import path from 'path';
import { CommitInfo, CommitTracker } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';
import { Profile } from '../model/Profile';
import { ProfileMetadata, ProfileGroupings } from '../model/Profile';
import {
  validateResults,
  flagZeroDurationTests,
  detectOutlierTests,
  validateCommitPresence,
} from '../validation/ProfilerValidator';
import { PROFILE_SCHEMA_VERSION } from '../../storage/SchemaVersions';

const WARN_INLINE_LIMIT = 10;
const REPORTS_DIR = path.resolve('.data', 'reports');

export class Profiler {
  generateProfile(results: TestResult[], commit?: CommitInfo): Profile {
    validateResults(results);

    const zeroDuration = flagZeroDurationTests(results);

    if (zeroDuration.length > 0) {
      const preview = zeroDuration.slice(0, WARN_INLINE_LIMIT).map((t) => t.name).join(', ');
      const suffix = zeroDuration.length > WARN_INLINE_LIMIT
        ? ` (and ${zeroDuration.length - WARN_INLINE_LIMIT} more — see .data/reports/zero-duration.txt)`
        : '';
      console.warn(`Warning: ${zeroDuration.length} test(s) reported zero duration: ${preview}${suffix}`);

      if (zeroDuration.length > WARN_INLINE_LIMIT) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(REPORTS_DIR, 'zero-duration.txt'), zeroDuration.map((t) => t.name).join('\n') + '\n');
      }
    }

    const outliers = detectOutlierTests(results);

    if (outliers.length > 0) {
      const preview = outliers.slice(0, WARN_INLINE_LIMIT).join(', ');
      const suffix = outliers.length > WARN_INLINE_LIMIT
        ? ` (and ${outliers.length - WARN_INLINE_LIMIT} more — see .data/reports/outliers.txt)`
        : '';
      console.warn(`Warning: ${outliers.length} test(s) have outlier durations within this run: ${preview}${suffix}`);

      if (outliers.length > WARN_INLINE_LIMIT) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(REPORTS_DIR, 'outliers.txt'), outliers.join('\n') + '\n');
      }
    }

    const testCount = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = testCount === 0 ? 0 : totalDuration / testCount;
    const metadata = this.collectMetadata(results, commit);

    validateCommitPresence(metadata);

    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      testResults: results,
      testCount,
      totalDuration,
      averageDuration,
      metadata,
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
