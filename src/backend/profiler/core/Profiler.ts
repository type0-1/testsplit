import { CommitInfo, CommitTracker } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';
import { Profile } from '../model/Profile';
import { validateResults } from '../validation/ProfilerValidator';
import { ProfileMetadata } from '../model/Profile';
import { PROFILE_SCHEMA_VERSION } from '../../storage/SchemaVersions';
import { EnvironmentCollector } from './EnvironmentCollector';

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
      metadata: EnvironmentCollector.collect(commit),
    };
  }
}
