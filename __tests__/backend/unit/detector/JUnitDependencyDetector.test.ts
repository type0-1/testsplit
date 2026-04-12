import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  detectJUnit5Dependencies,
  detectJUnit4Dependencies,
  parseOrderAnnotationsFromSource,
  parseFixMethodOrderFromSource,
} from '../../../../src/backend/detector/JUnitDependencyDetector';
import { Task } from '../../../../src/backend/algorithm/model/Task';

const JAVA_FIXTURES = path.resolve(__dirname, 'fixtures/java');

describe('parseOrderAnnotationsFromSource', () => {
  it('returns empty array when @TestMethodOrder is absent', () => {
    const source = `
      public class Foo {
        @Test @Order(1) public void a() {}
      }
    `;
    expect(parseOrderAnnotationsFromSource(source, 'Foo.java')).toHaveLength(0);
  });

  it('returns empty array when OrderAnnotation is absent', () => {
    const source = `
      @TestMethodOrder(MethodOrderer.Random.class)
      public class Foo {
        @Test @Order(1) public void a() {}
      }
    `;
    expect(parseOrderAnnotationsFromSource(source, 'Foo.java')).toHaveLength(0);
  });

  it('extracts class name from package declaration', () => {
    const source = `
      package com.example;
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      public class MyTest {
        @Test @Order(1) public void first() {}
        @Test @Order(2) public void second() {}
      }
    `;
    const result = parseOrderAnnotationsFromSource(source, 'MyTest.java');
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('com.example.MyTest');
  });

  it('returns methods sorted by @Order value', () => {
    const source = `
      package com.example;
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      public class MyTest {
        @Test @Order(3) public void third() {}
        @Test @Order(1) public void first() {}
        @Test @Order(2) public void second() {}
      }
    `;
    const result = parseOrderAnnotationsFromSource(source, 'MyTest.java');
    expect(result[0].methods.map((m) => m.name)).toEqual(['third', 'first', 'second']);
    expect(result[0].methods.map((m) => m.order)).toEqual([3, 1, 2]);
  });

  it('returns empty when class declaration is missing', () => {
    const source = `
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      @Test @Order(1) public void first() {}
    `;
    expect(parseOrderAnnotationsFromSource(source, 'NoClass.java')).toEqual([]);
  });

  it('returns empty when no method signatures can be extracted', () => {
    const source = `
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      public class WeirdOrder {
        @Order(1)
      }
    `;
    expect(parseOrderAnnotationsFromSource(source, 'WeirdOrder.java')).toEqual([]);
  });

  it('resolves class name from src/test/java path when package is absent', () => {
    const source = `
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      public class PathDerivedTest {
        @Test @Order(1) public void first() {}
      }
    `;
    const result = parseOrderAnnotationsFromSource(
      source,
      '/repo/src/test/java/com/example/PathDerivedTest.java',
    );
    expect(result[0].className).toBe('com.example.PathDerivedTest');
  });

  it('falls back to simple class name when package and path marker are absent', () => {
    const source = `
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      class LocalOnlyTest {
        @Test @Order(1) public void first() {}
      }
    `;
    const result = parseOrderAnnotationsFromSource(source, 'LocalOnlyTest.java');
    expect(result[0].className).toBe('LocalOnlyTest');
  });

  it('skips method extraction when regex matches reserved keyword names', () => {
    const source = `
      package com.example;
      @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
      public class KeywordTest {
        @Test @Order(1) public void if() {}
        @Test @Order(2) public void validName() {}
        @Test @Order(3) public void switch() {}
      }
    `;
    const result = parseOrderAnnotationsFromSource(source, 'KeywordTest.java');
    expect(result).toHaveLength(1);
    expect(result[0].methods).toHaveLength(1);
    expect(result[0].methods[0].name).toBe('validName');
    expect(result[0].methods[0].order).toBe(2);
  });

});

describe('detectJUnit5Dependencies', () => {
  it('returns existing tasks unchanged when no ordered classes found', () => {
    const tasks: Task[] = [{ id: 'com.example.UnorderedTest#someTest', duration: 1 }];
    const result = detectJUnit5Dependencies(
      path.join(JAVA_FIXTURES, 'com/example'),
      tasks,
    );
    // UnorderedTest has no @TestMethodOrder its task should be unchanged
    const t = result.find((r) => r.id === 'com.example.UnorderedTest#someTest');
    expect(t?.dependencies).toBeUndefined();
  });

  it('first method in order has empty dependencies array', () => {
    const tasks: Task[] = [
      { id: 'com.example.OrderedTest#firstTest', duration: 2 },
      { id: 'com.example.OrderedTest#secondTest', duration: 3 },
      { id: 'com.example.OrderedTest#thirdTest', duration: 1 },
    ];
    const result = detectJUnit5Dependencies(JAVA_FIXTURES, tasks);
    const first = result.find((t) => t.id === 'com.example.OrderedTest#firstTest');
    expect(first?.dependencies).toEqual([]);
  });

  it('second method depends on first', () => {
    const tasks: Task[] = [
      { id: 'com.example.OrderedTest#firstTest', duration: 2 },
      { id: 'com.example.OrderedTest#secondTest', duration: 3 },
      { id: 'com.example.OrderedTest#thirdTest', duration: 1 },
    ];
    const result = detectJUnit5Dependencies(JAVA_FIXTURES, tasks);
    const second = result.find((t) => t.id === 'com.example.OrderedTest#secondTest');
    expect(second?.dependencies).toContain('com.example.OrderedTest#firstTest');
  });

  it('third method depends on second (chain)', () => {
    const tasks: Task[] = [
      { id: 'com.example.OrderedTest#firstTest', duration: 2 },
      { id: 'com.example.OrderedTest#secondTest', duration: 3 },
      { id: 'com.example.OrderedTest#thirdTest', duration: 1 },
    ];
    const result = detectJUnit5Dependencies(JAVA_FIXTURES, tasks);
    const third = result.find((t) => t.id === 'com.example.OrderedTest#thirdTest');
    expect(third?.dependencies).toContain('com.example.OrderedTest#secondTest');
    expect(third?.dependencies).not.toContain('com.example.OrderedTest#firstTest');
  });

  it('creates task entries for ordered methods not in existingTasks', () => {
    const result = detectJUnit5Dependencies(JAVA_FIXTURES, []);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('com.example.OrderedTest#firstTest');
    expect(ids).toContain('com.example.OrderedTest#secondTest');
    expect(ids).toContain('com.example.OrderedTest#thirdTest');
  });

  it('returns empty array when srcRoot does not exist', () => {
    const tasks: Task[] = [{ id: 'A#b', duration: 1 }];
    const result = detectJUnit5Dependencies('/nonexistent/path', tasks);
    expect(result).toEqual(tasks);
  });

  it('does not duplicate dependency when previous method dependency already exists', () => {
    const tasks: Task[] = [
      { id: 'com.example.OrderedTest#firstTest', duration: 2 },
      { id: 'com.example.OrderedTest#secondTest', duration: 3, dependencies: ['com.example.OrderedTest#firstTest'] },
      { id: 'com.example.OrderedTest#thirdTest', duration: 1 },
    ];
    const result = detectJUnit5Dependencies(JAVA_FIXTURES, tasks);
    const second = result.find((t) => t.id === 'com.example.OrderedTest#secondTest');
    expect(second?.dependencies).toEqual(['com.example.OrderedTest#firstTest']);
  });

  it('recursively scans nested directories and only processes .java files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'junit5-collect-java-'));
    const nested = path.join(tempRoot, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });

    try {
      fs.writeFileSync(path.join(tempRoot, 'README.md'), '# ignore', 'utf-8');
      fs.writeFileSync(path.join(nested, 'OrderedFromTemp.java'), `
        package com.temp;
        import org.junit.jupiter.api.MethodOrderer;
        import org.junit.jupiter.api.Order;
        import org.junit.jupiter.api.Test;
        import org.junit.jupiter.api.TestMethodOrder;

        @TestMethodOrder(MethodOrderer.OrderAnnotation.class)
        public class OrderedFromTemp {
          @Test @Order(1) public void a() {}
          @Test @Order(2) public void b() {}
        }
      `, 'utf-8');
      fs.writeFileSync(path.join(nested, 'NotJava.txt'), '@Order(1) text only', 'utf-8');

      const result = detectJUnit5Dependencies(tempRoot, []);
      const ids = result.map((t) => t.id).sort();
      expect(ids).toEqual(['com.temp.OrderedFromTemp#a', 'com.temp.OrderedFromTemp#b']);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('parseFixMethodOrderFromSource (JUnit 4)', () => {
  it('returns empty array when @FixMethodOrder is absent', () => {
    const source = `public class Foo { @Test public void a() {} }`;
    expect(parseFixMethodOrderFromSource(source, 'Foo.java')).toHaveLength(0);
  });

  it('returns empty array for DEFAULT and JVM sorters', () => {
    const defaultSrc = `
      @FixMethodOrder(MethodSorters.DEFAULT)
      public class Foo { @Test public void a() {} }
    `;
    const jvmSrc = `
      @FixMethodOrder(MethodSorters.JVM)
      public class Foo { @Test public void a() {} }
    `;
    expect(parseFixMethodOrderFromSource(defaultSrc, 'Foo.java')).toHaveLength(0);
    expect(parseFixMethodOrderFromSource(jvmSrc, 'Foo.java')).toHaveLength(0);
  });

  it('returns methods in alphabetical order for NAME_ASCENDING', () => {
    const source = `
      package com.example;
      @FixMethodOrder(MethodSorters.NAME_ASCENDING)
      public class AlphaTest {
        @Test public void zebra() {}
        @Test public void apple() {}
        @Test public void mango() {}
      }
    `;
    const result = parseFixMethodOrderFromSource(source, 'AlphaTest.java');
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('com.example.AlphaTest');
    expect(result[0].methods).toEqual(['apple', 'mango', 'zebra']);
  });

  it('returns empty when class declaration is missing for JUnit4 source', () => {
    const source = `
      @FixMethodOrder(MethodSorters.NAME_ASCENDING)
      @Test public void zebra() {}
    `;
    expect(parseFixMethodOrderFromSource(source, 'NoClass.java')).toEqual([]);
  });

  it('returns empty when no JUnit4 test methods are found', () => {
    const source = `
      @FixMethodOrder(MethodSorters.NAME_ASCENDING)
      public class NoTests {}
    `;
    expect(parseFixMethodOrderFromSource(source, 'NoTests.java')).toEqual([]);
  });
});

describe('detectJUnit4Dependencies', () => {
  it('chains methods alphabetically for NAME_ASCENDING class', () => {
    const tasks: Task[] = [
      { id: 'com.example.JUnit4OrderedTest#apple', duration: 1 },
      { id: 'com.example.JUnit4OrderedTest#mango', duration: 2 },
      { id: 'com.example.JUnit4OrderedTest#zebra', duration: 3 },
    ];
    const result = detectJUnit4Dependencies(JAVA_FIXTURES, tasks);

    const apple = result.find((t) => t.id === 'com.example.JUnit4OrderedTest#apple');
    const mango = result.find((t) => t.id === 'com.example.JUnit4OrderedTest#mango');
    const zebra = result.find((t) => t.id === 'com.example.JUnit4OrderedTest#zebra');

    expect(apple?.dependencies).toEqual([]);
    expect(mango?.dependencies).toContain('com.example.JUnit4OrderedTest#apple');
    expect(zebra?.dependencies).toContain('com.example.JUnit4OrderedTest#mango');
  });

  it('ignores classes with DEFAULT or JVM sorters', () => {
    const tasks: Task[] = [
      { id: 'com.example.JUnit4DefaultOrderTest#someTest', duration: 1 },
    ];
    const result = detectJUnit4Dependencies(JAVA_FIXTURES, tasks);
    const t = result.find((r) => r.id === 'com.example.JUnit4DefaultOrderTest#someTest');
    expect(t?.dependencies).toBeUndefined();
  });

  it('returns existing tasks unchanged when srcRoot does not exist', () => {
    const tasks: Task[] = [{ id: 'A#b', duration: 1 }];
    expect(detectJUnit4Dependencies('/nonexistent', tasks)).toEqual(tasks);
  });

  it('does not duplicate dependency when previous alphabetical dependency already exists', () => {
    const tasks: Task[] = [
      { id: 'com.example.JUnit4OrderedTest#apple', duration: 1 },
      { id: 'com.example.JUnit4OrderedTest#mango', duration: 2, dependencies: ['com.example.JUnit4OrderedTest#apple'] },
      { id: 'com.example.JUnit4OrderedTest#zebra', duration: 3 },
    ];
    const result = detectJUnit4Dependencies(JAVA_FIXTURES, tasks);
    const mango = result.find((t) => t.id === 'com.example.JUnit4OrderedTest#mango');
    expect(mango?.dependencies).toEqual(['com.example.JUnit4OrderedTest#apple']);
  });
});
