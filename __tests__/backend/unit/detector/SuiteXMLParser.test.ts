import * as path from 'path';
import {
  parseSuiteXML,
  parseSuiteXMLFromSource,
  parseSelectClassesFromSource,
  buildSuiteTaskDependencies,
} from '../../../../src/backend/detector/SuiteXMLParser';
import { Task } from '../../../../src/backend/algorithm/model/Task';

const SUITE_FIXTURES = path.resolve(__dirname, 'fixtures/suite');

describe('parseSuiteXMLFromSource', () => {
  it('returns empty array for non-suite XML', () => {
    expect(parseSuiteXMLFromSource('<project></project>')).toHaveLength(0);
  });

  it('parses a single <test> block with ordered classes', () => {
    const xml = `
      <suite name="My Suite">
        <test name="Unit Tests">
          <classes>
            <class name="com.example.ATest"/>
            <class name="com.example.BTest"/>
          </classes>
        </test>
      </suite>
    `;
    const result = parseSuiteXMLFromSource(xml);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Unit Tests');
    expect(result[0].classes).toEqual(['com.example.ATest', 'com.example.BTest']);
  });

  it('returns one SuiteInfo per <test> block', () => {
    const result = parseSuiteXML(path.join(SUITE_FIXTURES, 'testng-suite.xml'));
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Setup Tests');
    expect(result[1].name).toBe('Feature Tests');
    expect(result[2].name).toBe('Teardown Tests');
  });

  it('preserves class declaration order within each <test> block', () => {
    const result = parseSuiteXML(path.join(SUITE_FIXTURES, 'testng-suite.xml'));
    expect(result[1].classes).toEqual([
      'com.example.LoginTest',
      'com.example.UserTest',
      'com.example.OrderTest',
    ]);
  });

  it('handles suite with a single <test> block', () => {
    const result = parseSuiteXML(path.join(SUITE_FIXTURES, 'testng-single-test.xml'));
    expect(result).toHaveLength(1);
    expect(result[0].classes).toEqual(['com.example.AlphaTest', 'com.example.BetaTest']);
  });
});

describe('parseSelectClassesFromSource', () => {
  it('returns empty array when @SelectClasses is absent', () => {
    const source = `public class MySuite {}`;
    expect(parseSelectClassesFromSource(source, 'MySuite.java')).toHaveLength(0);
  });

  it('parses @SelectClasses with fully imported class references', () => {
    const source = `
      package com.example.suites;
      import com.example.SetupTest;
      import com.example.MainTest;
      import org.junit.platform.suite.api.SelectClasses;
      import org.junit.platform.suite.api.Suite;

      @Suite
      @SelectClasses({ SetupTest.class, MainTest.class })
      public class MySuite {}
    `;
    const result = parseSelectClassesFromSource(source, 'MySuite.java');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('MySuite');
    expect(result[0].classes).toEqual(['com.example.SetupTest', 'com.example.MainTest']);
  });

  it('falls back to package prefix for unimported simple names', () => {
    const source = `
      package com.example;
      @Suite
      @SelectClasses({ FooTest.class, BarTest.class })
      public class AllTests {}
    `;
    const result = parseSelectClassesFromSource(source, 'AllTests.java');
    expect(result[0].classes).toEqual(['com.example.FooTest', 'com.example.BarTest']);
  });
});

describe('buildSuiteTaskDependencies', () => {
  it('first class in a suite has empty dependencies', () => {
    const suites = [{ name: 'S', classes: ['com.example.A', 'com.example.B', 'com.example.C'] }];
    const result = buildSuiteTaskDependencies(suites, []);
    const a = result.find((t) => t.id === 'com.example.A');
    expect(a?.dependencies).toEqual([]);
  });

  it('each subsequent class depends on the previous one', () => {
    const suites = [{ name: 'S', classes: ['com.example.A', 'com.example.B', 'com.example.C'] }];
    const result = buildSuiteTaskDependencies(suites, []);
    const b = result.find((t) => t.id === 'com.example.B');
    const c = result.find((t) => t.id === 'com.example.C');
    expect(b?.dependencies).toContain('com.example.A');
    expect(c?.dependencies).toContain('com.example.B');
    expect(c?.dependencies).not.toContain('com.example.A');
  });

  it('preserves existing task durations', () => {
    const suites = [{ name: 'S', classes: ['com.example.A', 'com.example.B'] }];
    const tasks: Task[] = [{ id: 'com.example.A', duration: 5 }];
    const result = buildSuiteTaskDependencies(suites, tasks);
    const a = result.find((t) => t.id === 'com.example.A');
    expect(a?.duration).toBe(5);
  });

  it('creates entries for classes not in existingTasks', () => {
    const suites = [{ name: 'S', classes: ['com.example.New'] }];
    const result = buildSuiteTaskDependencies(suites, []);
    expect(result.find((t) => t.id === 'com.example.New')).toBeDefined();
  });

  it('merges dependencies from D1/D2 graph with suite ordering', () => {
    const suites = [{ name: 'S', classes: ['com.example.A', 'com.example.B'] }];
    const tasks: Task[] = [
      { id: 'com.example.B', duration: 2, dependencies: ['com.example.External'] },
    ];
    const result = buildSuiteTaskDependencies(suites, tasks);
    const b = result.find((t) => t.id === 'com.example.B');
    expect(b?.dependencies).toContain('com.example.A');
    expect(b?.dependencies).toContain('com.example.External');
  });
});
