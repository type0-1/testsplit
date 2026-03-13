export interface TestResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
  filePath?: string;
  packageName?: string;
  className?: string;
  suiteStartupDuration?: number;
  suiteTeardownDuration?: number;
}