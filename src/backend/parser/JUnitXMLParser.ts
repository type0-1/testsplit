export interface TestResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
}

export function parseJUnitXML(_filePath: string): TestResult[] {
  // TODO: implement
  return [];
}
