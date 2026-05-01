import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { TestResult } from '../models/TestResult';
import { validateXMLStructure } from './JUnitXMLStructureValidator';

interface XmlPropertyNode { name?: string; value?: string | number | boolean }
interface XmlTestCase {
  skipped?: unknown; failure?: unknown; error?: unknown;
  classname?: string; name?: string; file?: string; time?: unknown;
}
interface XmlTestSuite {
  testcase?: XmlTestCase | XmlTestCase[];
  name?: string;
  properties?: { property?: XmlPropertyNode | XmlPropertyNode[] };
}
interface XmlParsed {
  testsuite?: XmlTestSuite;
  testsuites?: { testsuite?: XmlTestSuite | XmlTestSuite[] };
}

function parseDurationFromProperty(
  properties: Map<string, string>,
  secondKeys: string[],
  millisecondKeys: string[],
): number | undefined {
  for (const key of secondKeys) {
    const raw = properties.get(key);
    if (raw === undefined) {
      continue;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  for (const key of millisecondKeys) {
    const raw = properties.get(key);
    if (raw === undefined) {
      continue;
    }

    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed / 1000;
    }
  }

  return undefined;
}

function suitePropertyMap(suite: XmlTestSuite): Map<string, string> {
  const propertyNodes = suite?.properties?.property;
  if (!propertyNodes) {
    return new Map<string, string>();
  }

  const nodes = Array.isArray(propertyNodes) ? propertyNodes : [propertyNodes];
  const map = new Map<string, string>();

  for (const node of nodes) {
    if (typeof node?.name !== 'string') {
      continue;
    }
    map.set(node.name, String(node.value ?? ''));
  }

  return map;
}

function packageFromClassName(className?: string): string | undefined {
  if (!className) {
    return undefined;
  }

  const lastDot = className.lastIndexOf('.');
  if (lastDot <= 0) {
    return undefined;
  }

  return className.slice(0, lastDot);
}

function filePathFromClassName(className?: string): string | undefined {
  if (!className) {
    return undefined;
  }

  return `${className.replace(/\./g, '/')}.java`;
}

export function parseJUnitXMLFile(filePath: string): TestResult[] {
  const xml = readFileSync(filePath, 'utf-8');

  // Validate XML (warns but keeps going)
  validateXMLStructure(xml, filePath);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  let parsed: XmlParsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    console.warn(`[Parser] ${filePath}: Failed to parse XML`);
    return [];
  }

  let suites: XmlTestSuite[];

  if (parsed.testsuite) {
    suites = [parsed.testsuite];
  } else if (parsed.testsuites?.testsuite) {
    suites = Array.isArray(parsed.testsuites.testsuite)
      ? parsed.testsuites.testsuite
      : [parsed.testsuites.testsuite];
  } else {
    console.warn(
      `[Parser] ${filePath}: Missing <testsuite> or <testsuites> element`,
    );
    return [];
  }

  const results: TestResult[] = [];

  for (const suite of suites) {
    if (!suite.testcase) {
      continue;
    }

    const properties = suitePropertyMap(suite);
    const suiteStartupDuration = parseDurationFromProperty(
      properties,
      [
        'surefire.suite.startup.seconds',
        'surefire.startup.seconds',
        'suite.startup.seconds',
        'suite.startup.time',
      ],
      [
        'surefire.suite.startup.millis',
        'surefire.startup.millis',
        'suite.startup.millis',
      ],
    );
    const suiteTeardownDuration = parseDurationFromProperty(
      properties,
      [
        'surefire.suite.teardown.seconds',
        'surefire.teardown.seconds',
        'suite.teardown.seconds',
        'suite.teardown.time',
      ],
      [
        'surefire.suite.teardown.millis',
        'surefire.teardown.millis',
        'suite.teardown.millis',
      ],
    );

    const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];

    for (const tc of cases) {
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
      const className =
        typeof tc.classname === 'string'
          ? tc.classname
          : typeof suite.name === 'string'
            ? suite.name
            : undefined;
      const packageName = packageFromClassName(className);
      const testFilePath =
        (typeof tc.file === 'string' && tc.file.length > 0
          ? tc.file
          : undefined) ?? filePathFromClassName(className);

      let duration = 0;
      if (tc.time !== undefined) {
        const parsedTime = Number(tc.time);
        if (!Number.isNaN(parsedTime)) {
          duration = parsedTime;
        }
      }

      results.push({
        name: testName,
        duration,
        status,
        ...(className ? { classname: className } : {}),
        ...(testFilePath ? { filePath: testFilePath } : {}),
        ...(packageName ? { packageName } : {}),
        ...(className ? { className } : {}),
        ...(suiteStartupDuration !== undefined ? { suiteStartupDuration } : {}),
        ...(suiteTeardownDuration !== undefined
          ? { suiteTeardownDuration }
          : {}),
      });
    }
  }

  return results;
}