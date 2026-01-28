import { Profile } from '../profiler/model/Profile';
import { JobDistribution } from '../algorithm/model/JobDistribution';

export interface StoredProfile {
  schemaVersion: number;
  runId: string;
  createdAt: string;
  profile: Profile;
}

export interface StoredDistribution {
  schemaVersion: number;
  runId: string;
  createdAt: string;
  distribution: JobDistribution;
}
