import { XMLParser, XMLValidator } from 'fast-xml-parser';

export function validateXMLStructure(xml: string, filePath: string): void {
  try {
    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      console.warn(`[XML Error] ${filePath}: ${validation.err.msg}`);
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    const parsed = parser.parse(xml) as Record<string, unknown>;

    const hasTestsuiteRoot = Object.prototype.hasOwnProperty.call(
      parsed,
      'testsuite',
    );
    const hasTestsuitesRoot = Object.prototype.hasOwnProperty.call(
      parsed,
      'testsuites',
    );

    if (!hasTestsuiteRoot && !hasTestsuitesRoot) {
      console.warn(
        `[Schema Validation] ${filePath}: Missing required root element <testsuite> or <testsuites>`,
      );
      return;
    }

    const suitesRaw = hasTestsuiteRoot
      ? (parsed.testsuite as unknown)
      : ((parsed.testsuites as Record<string, unknown> | undefined)
          ?.testsuite as unknown);

    const suites = suitesRaw
      ? (Array.isArray(suitesRaw) ? suitesRaw : [suitesRaw])
      : [];

    for (const suite of suites) {
      const s = suite as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(s, 'name')) {
        console.warn(
          `[Schema Validation] ${filePath}: <testsuite> missing required 'name' attribute`,
        );
      }
      if (!Object.prototype.hasOwnProperty.call(s, 'tests')) {
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