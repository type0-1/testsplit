import * as fs from 'fs';
import { Task } from '../algorithm/model/Task';
import { collectJavaFiles, resolveClassName, applyOrderChain, extractJUnit4TestMethods } from './JavaFileUtils';

export interface AlphaOrderedClass {
  className: string;
  methods: string[]; // already in alphabetical order
}

/**
 * Scans Java source files under srcRoot for JUnit 4 @FixMethodOrder(MethodSorters.NAME_ASCENDING)
 * and returns a Task[] with dependencies chaining methods in alphabetical order.
 * Only NAME_ASCENDING is supported, DEFAULT and JVM are non-deterministic.
 */
export function detectJUnit4Dependencies(srcRoot: string, existingTasks: Task[]): Task[] {
  const javaFiles = collectJavaFiles(srcRoot);
  const orderedClasses = javaFiles.flatMap((f) => {
    const source = fs.readFileSync(f, 'utf-8');
    return parseFixMethodOrderFromSource(source, f);
  });

  if (orderedClasses.length === 0) return existingTasks;

  return applyOrderChain(existingTasks, orderedClasses);
}

export function parseFixMethodOrderFromSource(source: string, filePath: string): AlphaOrderedClass[] {
  if (!source.includes('@FixMethodOrder') || !source.includes('NAME_ASCENDING')) return [];

  const className = resolveClassName(source, filePath);
  if (!className) return [];

  const methods = extractJUnit4TestMethods(source).sort();
  if (methods.length === 0) return [];

  return [{ className, methods }];
}


