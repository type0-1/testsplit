import { TestResult } from '../../models/TestResult';

export interface Profile {
  testResults: TestResult[];
  totalDuration: number;
  averageDuration: number;
  testCount: number;
}
