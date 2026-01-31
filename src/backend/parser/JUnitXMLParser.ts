import { readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { DOMParser } from '@xmldom/xmldom';
import { TestResult } from '../models/TestResult';

// Validate XML structure. Warn on issues but keep going.
function validateXMLStructure(xml: string, filePath: string): void {
  try {
    const parser = new DOMParser({
      onError: (msg: string) => {
        console.warn(`[XML Error] ${filePath}: ${msg}`);
      },
    });
    
    const doc = parser.parseFromString(xml, 'text/xml');
    
    // Need <testsuite> or <testsuites> root
    const root = doc.documentElement;
    if (!root || (root.tagName !== 'testsuite' && root.tagName !== 'testsuites')) {
      console.warn(`[Schema Validation] ${filePath}: Missing required root element <testsuite> or <testsuites>`);
      return;
    }
    
    // Check for required name/tests attrs
    const testsuites = root.tagName === 'testsuites' 
      ? Array.from(root.getElementsByTagName('testsuite'))
      : [root];
    
    for (const suite of testsuites) {
      if (suite && !suite.hasAttribute('name')) {
        console.warn(`[Schema Validation] ${filePath}: <testsuite> missing required 'name' attribute`);
      }
      if (suite && !suite.hasAttribute('tests')) {
        console.warn(`[Schema Validation] ${filePath}: <testsuite> missing required 'tests' attribute`);
      }
    }
  } catch (error) {
    // Warn but don't crash
    console.warn(`[Schema Validation] ${filePath}: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
  }
}

// Parse single XML file (assumes it's a file, not a dir)
function parseJUnitXMLFile(filePath: string): TestResult[] {
  const xml = readFileSync(filePath, 'utf-8');

  // Validate XML (warns but keeps going)
  validateXMLStructure(xml, filePath);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const parsed = parser.parse(xml);

  if (!parsed.testsuite) {
    console.warn(`[Parser] ${filePath}: Missing <testsuite> element, skipping file`);
    return [];
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

// Parse file or directory (recurses if needed)
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
