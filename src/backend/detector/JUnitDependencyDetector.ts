import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../algorithm/model/Task';

export interface OrderedClass {
  className: string;
  methods: { name: string; order: number }[];
}

export interface AlphaOrderedClass {
  className: string;
  methods: string[]; // already in alphabetical order
}

/**
 * Scans Java source files under srcRoot for JUnit 5 @TestMethodOrder +
 * @Order annotations and returns a Task[] where each task's dependencies
 * array enforces the declared execution order within its class.
 *
 * Task IDs match the format used by JUnit XML reports: com.example.MyTest#methodName
 *
 */
export function detectJUnit5Dependencies(
  srcRoot: string,
  existingTasks: Task[],
): Task[] {
  const javaFiles = collectJavaFiles(srcRoot);
  const orderedClasses = javaFiles.flatMap(parseOrderAnnotations);

  if (orderedClasses.length === 0) return existingTasks;

  const taskMap = new Map<string, Task>(existingTasks.map((t) => [t.id, { ...t }]));

  for (const cls of orderedClasses) {
    const sorted = [...cls.methods].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sorted.length; i++) {
      const taskId = `${cls.className}#${sorted[i].name}`;
      const existing = taskMap.get(taskId) ?? { id: taskId, duration: 0 };

      if (i === 0) {
        taskMap.set(taskId, { ...existing, dependencies: existing.dependencies ?? [] });
      } else {
        const prevId = `${cls.className}#${sorted[i - 1].name}`;
        const deps = [...(existing.dependencies ?? [])];
        if (!deps.includes(prevId)) deps.push(prevId);
        taskMap.set(taskId, { ...existing, dependencies: deps });
      }
    }
  }

  return [...taskMap.values()];
}

function collectJavaFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJavaFiles(full));
    } else if (entry.name.endsWith('.java')) {
      results.push(full);
    }
  }
  return results;
}

export function parseOrderAnnotations(filePath: string): OrderedClass[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  return parseOrderAnnotationsFromSource(source, filePath);
}

export function parseOrderAnnotationsFromSource(source: string, filePath: string): OrderedClass[] {
  if (!source.includes('@TestMethodOrder') || !source.includes('@Order')) return [];
  if (!source.includes('OrderAnnotation')) return [];

  const className = resolveClassName(source, filePath);
  if (!className) return [];

  const methods = extractOrderedMethods(source);
  if (methods.length === 0) return [];

  return [{ className, methods }];
}

function resolveClassName(source: string, filePath: string): string | null {
  const pkgMatch = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  const classMatch = source.match(/(?:public\s+)?class\s+(\w+)/);
  if (!classMatch) return null;

  if (pkgMatch) return `${pkgMatch[1]}.${classMatch[1]}`;

  const normalized = filePath.replace(/\\/g, '/');
  const marker = 'src/test/java/';
  const idx = normalized.indexOf(marker);
  if (idx !== -1) {
    return normalized
      .slice(idx + marker.length)
      .replace(/\.java$/, '')
      .replace(/\//g, '.');
  }

  return classMatch[1];
}

/**
 * Scans Java source files under srcRoot for JUnit 4 @FixMethodOrder(MethodSorters.NAME_ASCENDING)
 * and returns a Task[] with dependencies chaining methods in alphabetical order.
 * Only NAME_ASCENDING is supported DEFAULT and JVM are non-deterministic.
 */
export function detectJUnit4Dependencies(
  srcRoot: string,
  existingTasks: Task[],
): Task[] {
  const javaFiles = collectJavaFiles(srcRoot);
  const orderedClasses = javaFiles.flatMap((f) => {
    const source = fs.readFileSync(f, 'utf-8');
    return parseFixMethodOrderFromSource(source, f);
  });

  if (orderedClasses.length === 0) return existingTasks;

  const taskMap = new Map<string, Task>(existingTasks.map((t) => [t.id, { ...t }]));

  for (const cls of orderedClasses) {
    for (let i = 0; i < cls.methods.length; i++) {
      const taskId = `${cls.className}#${cls.methods[i]}`;
      const existing = taskMap.get(taskId) ?? { id: taskId, duration: 0 };

      if (i === 0) {
        taskMap.set(taskId, { ...existing, dependencies: existing.dependencies ?? [] });
      } else {
        const prevId = `${cls.className}#${cls.methods[i - 1]}`;
        const deps = [...(existing.dependencies ?? [])];
        if (!deps.includes(prevId)) deps.push(prevId);
        taskMap.set(taskId, { ...existing, dependencies: deps });
      }
    }
  }

  return [...taskMap.values()];
}

export function parseFixMethodOrderFromSource(source: string, filePath: string): AlphaOrderedClass[] {
  if (!source.includes('@FixMethodOrder') || !source.includes('NAME_ASCENDING')) return [];

  const className = resolveClassName(source, filePath);
  if (!className) return [];

  const methods = extractJUnit4TestMethods(source).sort();
  if (methods.length === 0) return [];

  return [{ className, methods }];
}

function extractJUnit4TestMethods(source: string): string[] {
  const methods: string[] = [];
  const pattern = /@Test[\s\S]*?(?:public|protected)\s+void\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    methods.push(match[1]);
  }

  return methods;
}

function extractOrderedMethods(source: string): { name: string; order: number }[] {
  const methods: { name: string; order: number }[] = [];
  const pattern = /@Order\s*\(\s*(\d+)\s*\)[\s\S]*?(?:public|protected|private)\s+\S+\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const order = parseInt(match[1], 10);
    const name = match[2];
    if (/^(if|for|while|switch|catch|new)$/.test(name)) continue;
    methods.push({ name, order });
  }

  return methods;
}
