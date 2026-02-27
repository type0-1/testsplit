export interface TestResult {
  name: string;
  classname?: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
}