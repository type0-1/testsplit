import { statSync, readdirSync } from 'fs';
import { join } from 'path';

export function parseJUnitXMLPath<T>(
  path: string,
  parseXMLFile: (filePath: string) => T[],
): T[] {
  const stats = statSync(path);

  // Single file
  if (stats.isFile()) {
    return path.endsWith('.xml') ? parseXMLFile(path) : [];
  }

  // Directory (recursive)
  if (stats.isDirectory()) {
    return readdirSync(path).flatMap((entry) =>
      parseJUnitXMLPath(join(path, entry), parseXMLFile),
    );
  }

  // Other (symlink, socket, etc.)
  return [];
}