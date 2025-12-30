// src/backend/storage/StoragePaths.ts
import * as path from 'path';
import { RunId } from './Types';

export const DEFAULT_BASE_DIR = '.data';

export function profilesDir(baseDir: string = DEFAULT_BASE_DIR): string {
  return path.join(baseDir, 'profiles');
}

export function distributionsDir(baseDir: string = DEFAULT_BASE_DIR): string {
  return path.join(baseDir, 'distributions');
}

export function profilePath(runId: RunId, baseDir?: string): string {
  return path.join(profilesDir(baseDir), `${runId}.json`);
}

export function distributionPath(runId: RunId, baseDir?: string): string {
  return path.join(distributionsDir(baseDir), `${runId}.json`);
}
