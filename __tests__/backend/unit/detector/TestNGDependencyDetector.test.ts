import * as path from 'path';
import {
  detectTestNGDependencies,
  parseTestNGAnnotationsFromSource,
} from '../../../../src/backend/detector/TestNGDependencyDetector';
import { Task } from '../../../../src/backend/algorithm/model/Task';

const JAVA_FIXTURES = path.resolve(__dirname, 'fixtures/java');

describe('parseTestNGAnnotationsFromSource', () => {
  it('returns empty array when no @Test annotation present', () => {
    const source = `public class Foo { public void bar() {} }`;
    expect(parseTestNGAnnotationsFromSource(source, 'Foo.java')).toHaveLength(0);
  });

  it('returns empty array when @Test has no relevant attributes', () => {
    const source = `
      package com.example;
      public class Foo {
        @Test public void bar() {}
      }
    `;
    expect(parseTestNGAnnotationsFromSource(source, 'Foo.java')).toHaveLength(0);
  });

  it('parses dependsOnMethods as a single string', () => {
    const source = `
      package com.example;
      public class MyTest {
        @Test public void setup() {}
        @Test(dependsOnMethods = "setup") public void run() {}
      }
    `;
    const result = parseTestNGAnnotationsFromSource(source, 'MyTest.java');
    const run = result.find((m) => m.methodName === 'run');
    expect(run?.dependsOnMethods).toEqual(['setup']);
  });

  it('parses dependsOnMethods as a string array', () => {
    const source = `
      package com.example;
      public class MyTest {
        @Test public void a() {}
        @Test public void b() {}
        @Test(dependsOnMethods = {"a", "b"}) public void c() {}
      }
    `;
    const result = parseTestNGAnnotationsFromSource(source, 'MyTest.java');
    const c = result.find((m) => m.methodName === 'c');
    expect(c?.dependsOnMethods).toEqual(['a', 'b']);
  });

  it('parses dependsOnGroups', () => {
    const source = `
      package com.example;
      public class MyTest {
        @Test(groups = {"setup"}) public void seed() {}
        @Test(dependsOnGroups = {"setup"}) public void verify() {}
      }
    `;
    const result = parseTestNGAnnotationsFromSource(source, 'MyTest.java');
    const verify = result.find((m) => m.methodName === 'verify');
    expect(verify?.dependsOnGroups).toEqual(['setup']);
  });

  it('parses groups attribute', () => {
    const source = `
      package com.example;
      public class MyTest {
        @Test(groups = {"setup", "db"}) public void seed() {}
      }
    `;
    const result = parseTestNGAnnotationsFromSource(source, 'MyTest.java');
    const seed = result.find((m) => m.methodName === 'seed');
    expect(seed?.groups).toEqual(['setup', 'db']);
  });
});

describe('detectTestNGDependencies', () => {
  it('populates dependencies from dependsOnMethods', () => {
    const tasks: Task[] = [
      { id: 'com.example.TestNGOrderedTest#createUser', duration: 1 },
      { id: 'com.example.TestNGOrderedTest#verifyUser', duration: 2 },
      { id: 'com.example.TestNGOrderedTest#deleteUser', duration: 1 },
    ];
    const result = detectTestNGDependencies(JAVA_FIXTURES, tasks);

    const verify = result.find((t) => t.id === 'com.example.TestNGOrderedTest#verifyUser');
    expect(verify?.dependencies).toContain('com.example.TestNGOrderedTest#createUser');

    const del = result.find((t) => t.id === 'com.example.TestNGOrderedTest#deleteUser');
    expect(del?.dependencies).toContain('com.example.TestNGOrderedTest#verifyUser');
    expect(del?.dependencies).toContain('com.example.TestNGOrderedTest#createUser');
  });

  it('method with no depends annotations has no dependencies added', () => {
    const tasks: Task[] = [
      { id: 'com.example.TestNGOrderedTest#createUser', duration: 1 },
    ];
    const result = detectTestNGDependencies(JAVA_FIXTURES, tasks);
    const create = result.find((t) => t.id === 'com.example.TestNGOrderedTest#createUser');
    expect(create?.dependencies).toBeUndefined();
  });

  it('resolves dependsOnGroups to individual task IDs', () => {
    const tasks: Task[] = [
      { id: 'com.example.TestNGGroupsTest#startServer', duration: 1 },
      { id: 'com.example.TestNGGroupsTest#seedDatabase', duration: 1 },
      { id: 'com.example.TestNGGroupsTest#runSuite', duration: 3 },
    ];
    const result = detectTestNGDependencies(JAVA_FIXTURES, tasks);

    const runSuite = result.find((t) => t.id === 'com.example.TestNGGroupsTest#runSuite');
    expect(runSuite?.dependencies).toContain('com.example.TestNGGroupsTest#startServer');
    expect(runSuite?.dependencies).toContain('com.example.TestNGGroupsTest#seedDatabase');
  });

  it('returns existing tasks unchanged when srcRoot does not exist', () => {
    const tasks: Task[] = [{ id: 'A#b', duration: 1 }];
    expect(detectTestNGDependencies('/nonexistent', tasks)).toEqual(tasks);
  });

  it('creates task entries for methods not in existingTasks', () => {
    const result = detectTestNGDependencies(JAVA_FIXTURES, []);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('com.example.TestNGOrderedTest#verifyUser');
    expect(ids).toContain('com.example.TestNGOrderedTest#deleteUser');
  });
});
