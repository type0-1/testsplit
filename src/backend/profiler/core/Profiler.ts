import { CommitInfo } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';
import { Profile } from '../model/Profile';
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
      metadata,
    };
  }
}
