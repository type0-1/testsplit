import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../algorithm/model/Task';

export function collectJavaFiles(dir: string): string[] {
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

export function resolveClassName(source: string, filePath: string): string | null {
  const pkgMatch = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  const classMatch = source.match(/(?:public\s+)?class\s+(\w+)/);
  if (!classMatch) return null;

  if (pkgMatch) return `${pkgMatch[1]}.${classMatch[1]}`;

  const normalized = filePath.replace(/\\/g, '/');
  const marker = 'src/test/java/';
  const idx = normalized.indexOf(marker);
  if (idx !== -1) {
    return normalized.slice(idx + marker.length).replace(/\.java$/, '').replace(/\//g, '.');
  }

  return classMatch[1];
}

export function applyOrderChain(existingTasks: Task[], chains: { className: string; methods: string[] }[]): Task[] {
  const taskMap = new Map<string, Task>(existingTasks.map((t) => [t.id, { ...t }]));

  for (const cls of chains) {
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

export function extractOrderedMethods(source: string): { name: string; order: number }[] {
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

export function extractJUnit4TestMethods(source: string): string[] {
  const methods: string[] = [];
  const pattern = /@Test[\s\S]*?(?:public|protected)\s+void\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    methods.push(match[1]);
  }

  return methods;
}
