import { CommitInfo } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';

export interface ProfileMetadata {
  commit: CommitInfo | null;
  generatedAt: string | null;

  cpuModel: string;
  cpuCores: number;
  osVersion: string;
  platform: string;
  nodeVersion: string;
  containerVersion: string;
}
export interface Profile {
  schemaVersion: number;
  testResults: TestResult[];
  totalDuration: number;
  averageDuration: number;
  testCount: number;
  metadata: ProfileMetadata;
}
