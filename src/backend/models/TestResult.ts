export interface TestResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
}