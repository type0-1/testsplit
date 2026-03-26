import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { Task } from '../algorithm/model/Task';

export interface SuiteInfo {
  name: string;
  classes: string[]; // fully qualified class names in declared order
}

/**
 * Parses a TestNG suite XML file and returns one SuiteInfo per <test> block.
 * Classes within each <test> block are ordered as declared then TestNG runs
 * them sequentially by default, so order matters for dependency purposes.
 */

export function parseSuiteXML(xmlPath: string): SuiteInfo[] {
  const content = fs.readFileSync(xmlPath, 'utf-8');
  return parseSuiteXMLFromSource(content);
}

export function parseSuiteXMLFromSource(xml: string): SuiteInfo[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['test', 'class'].includes(name),
  });

  const parsed = parser.parse(xml);
  const suite = parsed?.suite;
  if (!suite) return [];

  const tests: any[] = Array.isArray(suite.test) ? suite.test : suite.test ? [suite.test] : [];

  return tests.map((test) => {
      const name: string = test['@_name'] ?? 'unnamed';
      const classNodes: any[] = Array.isArray(test?.classes?.class) ? test.classes.class : test?.classes?.class ? [test.classes.class] : [];
      const classes = classNodes.map((c) => (typeof c === 'string' ? c : c['@_name'])).filter(Boolean);

      return { name, classes };
    })
    .filter((s) => s.classes.length > 0);
}

/**
 * Scans Java source for JUnit Platform Suite @SelectClasses annotations.
 * Returns one SuiteInfo per suite class found, with classes in declared order.
 *
 * Example:
 *   @Suite
 *   @SelectClasses({ SetupTest.class, MainTest.class })
 *   public class MySuite {}
 */

export function parseSelectClassesFromSource(source: string, filePath: string): SuiteInfo[] {
  if (!source.includes('@SelectClasses')) return [];

  const pkgMatch = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  const pkg = pkgMatch?.[1] ?? '';

  // Resolve import aliases: import com.example.SetupTest -> SetupTest -> com.example.SetupTest
  const importMap = buildImportMap(source);

  const suites: SuiteInfo[] = [];
  const pattern = /@SelectClasses\s*\(\s*\{([^}]+)\}\s*\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const body = match[1];

    // Extract Foo.class references
    const classRefs = [...body.matchAll(/(\w+)\.class/g)].map((m) => m[1]);

    const classes = classRefs.map((ref) => {
      if (importMap.has(ref)) return importMap.get(ref)!;
      if (pkg) return `${pkg}.${ref}`;
      return ref;
    });

    if (classes.length > 0) {
      const suiteClassMatch = source.match(/(?:public\s+)?class\s+(\w+)/);
      const suiteName = suiteClassMatch ? suiteClassMatch[1] : filePath;
      suites.push({ name: suiteName, classes });
    }
  }

  return suites;
}

/**
 * Converts ordered SuiteInfo[] into Task dependencies.
 * Each class in a suite depends on the previous class in the same suite,
 * forming a chain that LPT's topological sort will respect.
 *
 * Task IDs are class-level (no #method suffix) to match JUnit XML class names.
 */
export function buildSuiteTaskDependencies(suites: SuiteInfo[], existingTasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>(existingTasks.map((t) => [t.id, { ...t }]));

  for (const suite of suites) {
    for (let i = 0; i < suite.classes.length; i++) {
      const taskId = suite.classes[i];
      const existing = taskMap.get(taskId) ?? { id: taskId, duration: 0 };

      if (i === 0) {
        taskMap.set(taskId, { ...existing, dependencies: existing.dependencies ?? [] });
      } else {
        const prevId = suite.classes[i - 1];
        const deps = [...(existing.dependencies ?? [])];
        if (!deps.includes(prevId)) deps.push(prevId);
        taskMap.set(taskId, { ...existing, dependencies: deps });
      }
    }
  }

  return [...taskMap.values()];
}

function buildImportMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const importPattern = /^\s*import\s+([\w.]+)\.(\w+)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = importPattern.exec(source)) !== null) {
    map.set(m[2], `${m[1]}.${m[2]}`);
  }
  return map;
}
