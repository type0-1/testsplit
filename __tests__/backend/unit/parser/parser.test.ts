import { parseJUnitXML } from '../../../../src/backend/parser/JUnitXMLParser';
import * as path from 'path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

describe('JUnitXMLParser', () => {
  test('parses test names and durations', () => {
    const results = parseJUnitXML(fixture('basic.xml'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      name: 'ExampleTest.testA',
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
  });

  test('handles parameterised tests', () => {
    const results = parseJUnitXML(fixture('parameterised.xml'));

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('ExampleTest.testMethod[1]');
    expect(results[0].className).toBe('ExampleTest');
    expect(results[0].filePath).toBe('ExampleTest.java');
    expect(results[1].name).toBe('ExampleTest.testMethod[2]');
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
});
