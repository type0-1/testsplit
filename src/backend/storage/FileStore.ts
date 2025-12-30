// src/backend/storage/FileStore.ts

import * as fs from 'fs';
import {
  profilesDir,
  distributionsDir,
  profilePath,
  distributionPath,
} from './StoragePaths';
import { RunId } from './Types';

export class FileStore {
  constructor(private baseDir: string = '.data') {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    fs.mkdirSync(profilesDir(this.baseDir), { recursive: true });
    fs.mkdirSync(distributionsDir(this.baseDir), { recursive: true });
  }

  saveProfile(runId: RunId, profile: unknown): void {
    fs.writeFileSync(profilePath(runId, this.baseDir), JSON.stringify(profile, null, 2), 'utf-8');
  }

  saveDistribution(runId: RunId, distribution: unknown): void {
    fs.writeFileSync(distributionPath(runId, this.baseDir), JSON.stringify(distribution, null, 2), 'utf-8');
  }
}
