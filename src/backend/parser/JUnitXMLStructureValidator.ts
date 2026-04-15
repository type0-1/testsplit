import { DOMParser } from '@xmldom/xmldom';

export function validateXMLStructure(xml: string, filePath: string): void {
  try {
    const parser = new DOMParser({
      onError: (msg: string) => {
        console.warn(`[XML Error] ${filePath}: ${msg}`);
      },
    });

    const doc = parser.parseFromString(xml, 'text/xml');

    const root = doc.documentElement;
    if (
      !root ||
      (root.tagName !== 'testsuite' && root.tagName !== 'testsuites')
    ) {
      console.warn(
        `[Schema Validation] ${filePath}: Missing required root element <testsuite> or <testsuites>`,
      );
      return;
    }

    const testsuites =
      root.tagName === 'testsuites'
        ? Array.from(root.getElementsByTagName('testsuite'))
        : [root];

    for (const suite of testsuites) {
      if (suite && !suite.hasAttribute('name')) {
        console.warn(
          `[Schema Validation] ${filePath}: <testsuite> missing required 'name' attribute`,
        );
      }
      if (suite && !suite.hasAttribute('tests')) {
        console.warn(
          `[Schema Validation] ${filePath}: <testsuite> missing required 'tests' attribute`,
        );
      }
    }
  } catch (error) {
    console.warn(
      `[Schema Validation] ${filePath}: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
    );
  }
}