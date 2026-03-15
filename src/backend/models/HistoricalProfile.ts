import { Profile, ProfileMetadata } from '../profiler/model/Profile';
import { HistoricalTestStats } from './HistoricalTestStats';

export interface HistoricalProfile {
  runCount: number;
  totalTests: number;
  averageTestDuration: number;
  testDurationVariance: number;
  profiles: Profile[];
  perTestStats: Record<string, HistoricalTestStats>;
  metadata: ProfileMetadata[];
}