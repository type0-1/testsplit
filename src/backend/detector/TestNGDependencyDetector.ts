import * as fs from 'fs';
import { Task } from '../algorithm/model/Task';
import { collectJavaFiles, resolveClassName } from './JavaFileUtils';

export interface TestNGMethod {
  className: string;
  methodName: string;
  dependsOnMethods: string[];
  dependsOnGroups: string[];
  groups: string[];
}

/**
 * Scans Java source files under srcRoot for TestNG @Test annotations with
 * dependsOnMethods and dependsOnGroups attributes, then populates
 * Task.dependencies so LPT's topological sort respects the declared order.
 *
 * Task IDs to match JUnit XML report format: com.example.MyTest#methodName
 */
export function detectTestNGDependencies(srcRoot: string, existingTasks: Task[]): Task[] {
  const javaFiles = collectJavaFiles(srcRoot);
  
  const allMethods = javaFiles.flatMap((f) => {
    const source = fs.readFileSync(f, 'utf-8');
    return parseTestNGAnnotationsFromSource(source, f);
  });

  if (allMethods.length === 0) return existingTasks;

  // Build group to a [taskId] index for resolving dependsOnGroups
  const groupIndex = buildGroupIndex(allMethods);

  const taskMap = new Map<string, Task>(existingTasks.map((t) => [t.id, { ...t }]));

  for (const method of allMethods) {
    const taskId = `${method.className}#${method.methodName}`;
    const existing = taskMap.get(taskId) ?? { id: taskId, duration: 0 };
    const deps = new Set<string>(existing.dependencies ?? []);

    // Direct method dependencies (same class assumed when unqualified)
    for (const dep of method.dependsOnMethods) {
      const qualified = dep.includes('#') ? dep : `${method.className}#${dep}`;
      if (qualified !== taskId) deps.add(qualified);
    }

    // Group based dependencies
    for (const group of method.dependsOnGroups) {
      const members = groupIndex.get(group) ?? [];
      for (const memberId of members) {
        if (memberId !== taskId) deps.add(memberId);
      }
    }

    if (deps.size > 0 || method.dependsOnMethods.length > 0 || method.dependsOnGroups.length > 0) {
      taskMap.set(taskId, { ...existing, dependencies: [...deps] });
    }
  }

  return [...taskMap.values()];
}

export function parseTestNGAnnotationsFromSource(source: string, filePath: string): TestNGMethod[] {
  if (!source.includes('@Test') || (!source.includes('dependsOnMethods') && !source.includes('dependsOnGroups') && !source.includes('groups'))) {
    return [];
  }

  const className = resolveClassName(source, filePath);
  if (!className) return [];

  return extractTestNGMethods(source, className);
}

function buildGroupIndex(methods: TestNGMethod[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const m of methods) {
    const taskId = `${m.className}#${m.methodName}`;
    for (const group of m.groups) {
      const existing = index.get(group) ?? [];
      existing.push(taskId);
      index.set(group, existing);
    }
  }
  return index;
}

function extractTestNGMethods(source: string, className: string): TestNGMethod[] {
  const methods: TestNGMethod[] = [];

  /**
   * Match @Test(...) annotations followed by a method declaration 
   * then capture the full anotation body to parse attributes.
   */
  
  const annotationPattern = /@Test\s*(\([^)]*\))?\s*(?:public|protected|private)\s+\S+\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;

  while ((match = annotationPattern.exec(source)) !== null) {
    const annotationBody = match[1] ?? '';
    const methodName = match[2];

    if (/^(if|for|while|switch|catch|new)$/.test(methodName)) continue;

    const dependsOnMethods = parseStringArray(annotationBody, 'dependsOnMethods');
    const dependsOnGroups = parseStringArray(annotationBody, 'dependsOnGroups');
    const groups = parseStringArray(annotationBody, 'groups');

    methods.push({ className, methodName, dependsOnMethods, dependsOnGroups, groups });
  }

  return methods;
}

/**
 * Parses a TestNG annotation attribute that accepts a string or string array.
 * Handles both:
 *    dependsOnMethods = "foo"
 *    dependsOnMethods = {"foo", "bar"}
 */
function parseStringArray(annotationBody: string, attribute: string): string[] {
  const attrPattern = new RegExp(`${attribute}\\s*=\\s*(?:\\{([^}]*)\\}|"([^"]*)")`);
  const attrMatch = annotationBody.match(attrPattern);
  if (!attrMatch) return [];

  const content = attrMatch[1] || attrMatch[2] || '';
  return content.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter((s) => s.length > 0);
}
