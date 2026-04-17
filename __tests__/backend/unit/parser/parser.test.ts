import { JUnitXMLParser } from '../../../../src/backend/parser/JUnitXMLParser';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DOMParser } from '@xmldom/xmldom';
import { XMLParser } from 'fast-xml-parser';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);
const parseJUnitXML = (xmlPath: string) => new JUnitXMLParser().parse(xmlPath);

describe('JUnitXMLParser', () => {
  test('parses test names and durations', () => {
    const results = parseJUnitXML(fixture('basic.xml'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      name: 'ExampleTest.testA',
      classname: 'ExampleTest',
      duration: 0.12,
      status: 'passed',
      className: 'ExampleTest',
      filePath: 'ExampleTest.java',
    });
  });

  test('detects skipped and failed tests', () => {
    const results = parseJUnitXML(fixture('failures.xml'));

    const statuses = results.map((r) => r.status);
    expect(statuses).toEqual(['passed', 'skipped', 'failed']);
  });

  test('parses multiple suites under <testsuites>', () => {
    const results = parseJUnitXML(fixture('multi-suite.xml'));

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('A.test1');
    expect(results[0].className).toBe('A');
    expect(results[0].filePath).toBe('A.java');
    expect(results[1].name).toBe('B.test2');
    expect(results[1].className).toBe('B');
    expect(results[1].filePath).toBe('B.java');
    expect(results[0].classname).toBe('A');
    expect(results[1].name).toBe('B.test2');
    expect(results[1].classname).toBe('B');
  });

  test('parses single testsuite nested under testsuites object', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-single-suite-object-'));
    const file = path.join(tempDir, 'single-under-testsuites.xml');
    fs.writeFileSync(
      file,
      '<testsuites><testsuite name="OnlySuite" tests="1"><testcase classname="Only" name="testX" time="0.3"/></testsuite></testsuites>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Only.testX');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('preserves fully-qualified Maven classname separately from method name', () => {
    const results = parseJUnitXML(fixture('maven-fqn.xml'));

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe(
      'org.apache.commons.lang3.StringUtilsTest.testIsEmpty',
    );
    expect(results[0].classname).toBe(
      'org.apache.commons.lang3.StringUtilsTest',
    );
    expect(results[1].classname).toBe(
      'org.apache.commons.lang3.StringUtilsTest',
    );
  });

  test('handles parameterised tests', () => {
    const results = parseJUnitXML(fixture('parameterised.xml'));

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('ExampleTest.testMethod[1]');
    expect(results[0].className).toBe('ExampleTest');
    expect(results[0].filePath).toBe('ExampleTest.java');
    expect(results[0].classname).toBe('ExampleTest');
    expect(results[1].name).toBe('ExampleTest.testMethod[2]');
    expect(results[1].classname).toBe('ExampleTest');
  });

  test('parses surefire suite startup and teardown metadata', () => {
    const results = parseJUnitXML(fixture('surefire-lifecycle.xml'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      name: 'SurefireTest.testA',
      suiteStartupDuration: 0.08,
      suiteTeardownDuration: 0.12,
    });
    expect(results[1]).toMatchObject({
      name: 'SurefireTest.testB',
      suiteStartupDuration: 0.08,
      suiteTeardownDuration: 0.12,
    });
  });

  test('returns empty and warns when XML has no testsuite/testsuites element', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-root-'));
    const file = path.join(tempDir, 'missing-suite.xml');
    fs.writeFileSync(file, '<root><item /></root>', 'utf-8');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const results = parseJUnitXML(file);
      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing <testsuite> or <testsuites> element'),
      );
    } finally {
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('warns when testsuite is missing required name attribute', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-missing-name-'));
    const file = path.join(tempDir, 'missing-name.xml');
    fs.writeFileSync(file, '<testsuite tests="1"><testcase name="a" time="0.1"/></testsuite>', 'utf-8');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      parseJUnitXML(file);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing required 'name' attribute"),
      );
    } finally {
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('skips suites that do not contain testcase elements', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-no-cases-'));
    const file = path.join(tempDir, 'no-cases.xml');
    fs.writeFileSync(file, '<testsuite name="Suite" tests="0"></testsuite>', 'utf-8');

    try {
      const results = parseJUnitXML(file);
      expect(results).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('falls back to suite name for className and unknown-test for missing testcase name', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-fallbacks-'));
    const file = path.join(tempDir, 'fallbacks.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="FallbackSuite" tests="1"><testcase time="1.25" /></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('unknown-test');
      expect(results[0].className).toBe('FallbackSuite');
      expect(results[0].classname).toBe('FallbackSuite');
      expect(results[0].filePath).toBe('FallbackSuite.java');
      expect(results[0].duration).toBe(1.25);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('uses explicit testcase file path when provided and parses non-numeric time as zero', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-filepath-'));
    const file = path.join(tempDir, 'file-attr.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="S" tests="1"><testcase classname="pkg.ClassX" name="testA" file="custom/TestFile.kt" time="not-a-number" /></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].filePath).toBe('custom/TestFile.kt');
      expect(results[0].packageName).toBe('pkg');
      expect(results[0].duration).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('defaults duration to zero when testcase time is missing', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-no-time-'));
    const file = path.join(tempDir, 'no-time.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="S" tests="1"><testcase classname="pkg.ClassY" name="testNoTime" /></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].duration).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('parses startup/teardown durations from millisecond properties', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-millis-'));
    const file = path.join(tempDir, 'millis.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="MsSuite" tests="1"><properties><property name="surefire.suite.startup.millis" value="250" /><property name="surefire.suite.teardown.millis" value="500" /></properties><testcase classname="MsSuite" name="testA" time="0.1" /></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].suiteStartupDuration).toBe(0.25);
      expect(results[0].suiteTeardownDuration).toBe(0.5);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('prefers seconds property over millisecond property when both are present', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-seconds-priority-'));
    const file = path.join(tempDir, 'priority.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="PrioritySuite" tests="1"><properties><property name="surefire.suite.startup.seconds" value="1.2" /><property name="surefire.suite.startup.millis" value="9000" /></properties><testcase classname="PrioritySuite" name="testA" time="0.1" /></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].suiteStartupDuration).toBe(1.2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('returns empty for non-xml file paths', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-non-xml-'));
    const file = path.join(tempDir, 'report.txt');
    fs.writeFileSync(file, 'not xml', 'utf-8');

    try {
      const results = parseJUnitXML(file);
      expect(results).toEqual([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('recursively parses XML files in nested directories and ignores non-xml files', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-recursive-'));
    const nested = path.join(tempDir, 'nested');
    fs.mkdirSync(nested, { recursive: true });

    fs.writeFileSync(
      path.join(tempDir, 'a.xml'),
      '<testsuite name="A" tests="1"><testcase classname="A" name="one" time="0.1"/></testsuite>',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(nested, 'b.xml'),
      '<testsuite name="B" tests="1"><testcase classname="B" name="two" time="0.2"/></testsuite>',
      'utf-8',
    );
    fs.writeFileSync(path.join(nested, 'ignore.txt'), 'skip me', 'utf-8');

    try {
      const results = parseJUnitXML(tempDir);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name).sort()).toEqual(['A.one', 'B.two']);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('returns empty for unsupported fs entry types', () => {
    // /dev/null is a character device: neither file nor directory for this parser logic
    const results = parseJUnitXML('/dev/null');
    expect(results).toEqual([]);
  });

  test('warns and continues when XML structure validation throws', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-validation-throw-'));
    const file = path.join(tempDir, 'valid.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="Suite" tests="1"><testcase classname="C" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const domSpy = jest
      .spyOn(DOMParser.prototype, 'parseFromString')
      .mockImplementation(() => {
        throw new Error('dom parser exploded');
      });

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('dom parser exploded'),
      );
    } finally {
      domSpy.mockRestore();
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('returns empty and warns when XML parser throws', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-parse-throw-'));
    const file = path.join(tempDir, 'parse-throw.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="Suite" tests="1"><testcase classname="C" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const parseSpy = jest.spyOn(XMLParser.prototype, 'parse').mockImplementation(() => {
      throw new Error('xml parse failed');
    });

    try {
      const results = parseJUnitXML(file);
      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse XML'),
      );
    } finally {
      parseSpy.mockRestore();
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('skips suite properties that do not have a name attribute', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-unnamed-prop-'));
    const file = path.join(tempDir, 'unnamed-property.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="P" tests="1"><properties><property value="123" /></properties><testcase classname="P" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].suiteStartupDuration).toBeUndefined();
      expect(results[0].suiteTeardownDuration).toBeUndefined();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('treats named properties with missing value as empty string and keeps durations undefined', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-empty-prop-value-'));
    const file = path.join(tempDir, 'empty-prop-value.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="P" tests="1"><properties><property name="surefire.suite.startup.seconds" /></properties><testcase classname="P" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].suiteStartupDuration).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('ignores non-finite seconds and millisecond property values', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-non-finite-props-'));
    const file = path.join(tempDir, 'non-finite-props.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="NF" tests="1"><properties><property name="surefire.suite.startup.seconds" value="NaN" /><property name="surefire.suite.startup.millis" value="Infinity" /></properties><testcase classname="NF" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(results[0].suiteStartupDuration).toBeUndefined();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('emits XML parser onError warnings for malformed XML', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-dom-onerror-'));
    const file = path.join(tempDir, 'malformed.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="Broken" tests="1"><testcase classname="C" name="x" time="0.1"></testsuite>',
      'utf-8',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      parseJUnitXML(file);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[XML Error]'),
      );
    } finally {
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('uses unknown validation error message when DOM validation throws a non-Error', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-validation-non-error-'));
    const file = path.join(tempDir, 'valid.xml');
    fs.writeFileSync(
      file,
      '<testsuite name="Suite" tests="1"><testcase classname="C" name="t" time="0.1"/></testsuite>',
      'utf-8',
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const domSpy = jest
      .spyOn(DOMParser.prototype, 'parseFromString')
      .mockImplementation(() => {
        throw 'boom';
      });

    try {
      const results = parseJUnitXML(file);
      expect(results).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown validation error'),
      );
    } finally {
      domSpy.mockRestore();
      warnSpy.mockRestore();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
