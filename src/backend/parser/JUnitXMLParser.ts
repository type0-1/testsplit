import { readFileSync, statSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { TestResult } from '../models/TestResult';

/**
 * Parses a single JUnit XML file.
 * Internal helper — assumes filePath is a file.
 */
function parseJUnitXMLFile(filePath: string): TestResult[] {
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

/**
 * Public entry point.
 * Accepts a file or directory path.
 */
export function parseJUnitXML(path: string): TestResult[] {
  const stats = statSync(path);

  if (stats.isFile()) {
    return parseJUnitXMLFile(path);
  }

  if (stats.isDirectory()) {
    throw new Error('Directory parsing not implemented yet');
  }

  throw new Error('Unsupported path type');
}
