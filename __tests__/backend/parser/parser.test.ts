import { parseJUnitXML } from '../../../src/backend/parser/JUnitXMLParser';
import * as path from 'path';

const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

describe('JUnitXMLParser', () => {
  test('parses test names and durations', () => {
    const results = parseJUnitXML(fixture('basic.xml'));

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      name: 'ExampleTest.testA',
      duration: 0.12,
      status: 'passed',
    });
  });

  test('detects skipped and failed tests', () => {
    const results = parseJUnitXML(fixture('failures.xml'));

    const statuses = results.map((r) => r.status);
    expect(statuses).toEqual(['passed', 'skipped', 'failed']);
  });
});
