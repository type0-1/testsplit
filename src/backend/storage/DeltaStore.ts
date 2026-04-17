import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';

const MAX_UNCOMPRESSED_DELTAS = 50;
const MAX_ARCHIVED_DELTAS = 500; // Arbitrary max limit, will modify these vals later on as we figure things out

export function rotateHistoricalDeltas(deltasDir: string): void {
  const jsonFiles = fs
    .readdirSync(deltasDir)
    .filter((f) => f.endsWith('.json') && f.startsWith('delta-'))
    .sort();
  const toCompress = jsonFiles.slice(
    0,
    Math.max(0, jsonFiles.length - MAX_UNCOMPRESSED_DELTAS),
  );

  for (const file of toCompress) {
    const fullPath = path.join(deltasDir, file);
    const raw = fs.readFileSync(fullPath);
    const compressed = zlib.gzipSync(raw);

    fs.writeFileSync(`${fullPath}.gz`, compressed);
    fs.unlinkSync(fullPath);
  }
}

export function cleanupOldArchivedDeltas(deltasDir: string): void {
  const gzFiles = fs
    .readdirSync(deltasDir)
    .filter((f) => f.endsWith('.json.gz'))
    .sort();

  if (gzFiles.length <= MAX_ARCHIVED_DELTAS) {
    return;
  }

  const toDelete = gzFiles.slice(0, gzFiles.length - MAX_ARCHIVED_DELTAS);

  for (const file of toDelete) {
    fs.unlinkSync(path.join(deltasDir, file));
  }
}
