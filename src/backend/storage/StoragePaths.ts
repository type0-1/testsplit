import path from 'path';

export const BASE_DATA_DIR = '.data';
export const PROFILES_DIR = path.join(BASE_DATA_DIR, 'profiles');
export const DISTRIBUTIONS_DIR = path.join(BASE_DATA_DIR, 'distributions');

export function profilePath(runId: string): string {
  return path.join(PROFILES_DIR, `${runId}.json`);
}

export function distributionPath(runId: string): string {
  return path.join(DISTRIBUTIONS_DIR, `${runId}.json`);
}
