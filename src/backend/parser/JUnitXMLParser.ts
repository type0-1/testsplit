import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

export interface TestResult {
  name: string;
  duration: number;
  status: 'passed' | 'failed' | 'skipped';
}

export function parseJUnitXML(filePath: string): TestResult[] {
  const xml = readFileSync(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml);

  const testcases = parsed.testsuite?.testcase ?? [];
  const cases = Array.isArray(testcases) ? testcases : [testcases];

  return cases.map((tc: any) => {
    let status: 'passed' | 'failed' | 'skipped' = 'passed';

    if (tc.skipped !== undefined) {
      status = 'skipped';
    } else if (tc.failure !== undefined || tc.error !== undefined) {
      status = 'failed';
    }

    return {
      name: tc.classname ? `${tc.classname}.${tc.name}` : tc.name,
      duration: Number(tc.time) || 0,
      status,
    };
  });
}
