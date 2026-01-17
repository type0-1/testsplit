import { readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
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

  if (!parsed.testsuite) {
    throw new Error(`Invalid JUnit XML: missing <testsuite> in ${filePath}`);
  }

  const testcases = parsed.testsuite.testcase ?? [];
  const cases = Array.isArray(testcases) ? testcases : [testcases];

  return cases.map((tc: any) => {
    let status: 'passed' | 'failed' | 'skipped' = 'passed';

    if (tc.skipped !== undefined) {
      status = 'skipped';
    } else if (tc.failure !== undefined || tc.error !== undefined) {
      status = 'failed';
    }

    const testName =
      tc.classname && tc.name
        ? `${tc.classname}.${tc.name}`
        : (tc.name ?? 'unknown-test');

    let duration = 0;
    if (tc.time !== undefined) {
      const parsedTime = Number(tc.time);
      if (!Number.isNaN(parsedTime)) {
        duration = parsedTime;
      }
    }

    return {
      name: testName,
      duration,
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

  // Single file
  if (stats.isFile()) {
    return path.endsWith('.xml') ? parseJUnitXMLFile(path) : [];
  }

  // Directory (recursive)
  if (stats.isDirectory()) {
    return readdirSync(path).flatMap((entry) =>
      parseJUnitXML(join(path, entry)),
    );
  }

  // Other (symlink, socket, etc.)
  return [];
}
