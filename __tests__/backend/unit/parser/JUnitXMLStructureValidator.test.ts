import { XMLParser } from 'fast-xml-parser';
import { validateXMLStructure } from '../../../../src/backend/parser/JUnitXMLStructureValidator';

describe('JUnitXMLStructureValidator', () => {
  const filePath = '/tmp/test.xml';

  test('does not warn for a valid testsuite root with required attributes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure(
        '<testsuite name="SuiteA" tests="1"><testcase classname="A" name="t" time="0.1"/></testsuite>',
        filePath,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('warns when root is neither testsuite nor testsuites', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure('<root><x/></root>', filePath);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing required root element <testsuite> or <testsuites>'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('warns when testsuite is missing required name/tests attributes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure('<testsuite><testcase name="t"/></testsuite>', filePath);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing required 'name' attribute"),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing required 'tests' attribute"),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not warn for testsuites root with an array of valid testsuite nodes', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure(
        '<testsuites><testsuite name="SuiteA" tests="1"/><testsuite name="SuiteB" tests="2"/></testsuites>',
        filePath,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not warn when testsuites root has no testsuite children', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure('<testsuites></testsuites>', filePath);

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('warns with XML Error when XML syntax is malformed', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      validateXMLStructure('<testsuite name="Broken" tests="1"><testcase></testsuite>', filePath);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[XML Error]'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('warns and continues when parser throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const parseSpy = jest.spyOn(XMLParser.prototype, 'parse').mockImplementation(() => {
      throw new Error('parser exploded');
    });

    try {
      validateXMLStructure('<testsuite name="SuiteA" tests="1"></testsuite>', filePath);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('parser exploded'),
      );
    } finally {
      parseSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
