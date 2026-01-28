import { CommitInfo } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';

export interface ProfileMetadata {
  commit: CommitInfo | null;
  generatedAt: string | null;
}
export interface Profile {
  testResults: TestResult[];
  totalDuration: number;
  averageDuration: number;
  testCount: number;
  metadata: ProfileMetadata
}
