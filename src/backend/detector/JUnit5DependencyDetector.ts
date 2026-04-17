import * as fs from 'fs';
import { Task } from '../algorithm/model/Task';
import { collectJavaFiles, resolveClassName, applyOrderChain, extractOrderedMethods } from './JavaFileUtils';

export interface OrderedClass {
  className: string;
  methods: { name: string; order: number }[];
}

/**
 * Scans Java source files under srcRoot for JUnit 5 @TestMethodOrder +
 * @Order annotations and returns a Task[] where each task's dependencies
 * array enforces the declared execution order within its class.
 *
 * Task IDs match the format used by JUnit XML reports: com.example.MyTest#methodName
 */
export function detectJUnit5Dependencies(srcRoot: string, existingTasks: Task[]): Task[] {
  const javaFiles = collectJavaFiles(srcRoot);
  const orderedClasses = javaFiles.flatMap(parseOrderAnnotations);

  if (orderedClasses.length === 0) return existingTasks;

  const chains = orderedClasses.map((cls) => ({
    className: cls.className,
    methods: [...cls.methods].sort((a, b) => a.order - b.order).map((m) => m.name),
  }));

  return applyOrderChain(existingTasks, chains);
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


