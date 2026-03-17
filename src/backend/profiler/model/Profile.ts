import { CommitInfo } from '../../helpers/CommitTracker';
import { TestResult } from '../../models/TestResult';

export interface GroupingSummary {
  testCount: number;
  totalDuration: number;
}

export interface ProfileGroupings {
  byFilePath: Record<string, GroupingSummary>;
  byPackage: Record<string, GroupingSummary>;
  byClassName: Record<string, GroupingSummary>;
}

export interface ProfileMetadata {
  commit: CommitInfo | null;
  generatedAt: string | null;

  cpuModel: string;
  cpuCores: number;
  osVersion: string;
  platform: string;
  nodeVersion: string;
  containerVersion: string;
  memoryLimitMb?: number | null;
  groupings?: ProfileGroupings;
}
export interface Profile {
  schemaVersion: number;
  testResults: TestResult[];
  totalDuration: number;
  averageDuration: number;
  testCount: number;
  metadata: ProfileMetadata;
}
