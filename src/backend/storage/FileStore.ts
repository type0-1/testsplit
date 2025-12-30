// src/backend/storage/FileStore.ts

import fs from 'fs';
import {
  PROFILES_DIR,
  DISTRIBUTIONS_DIR,
  profilePath,
  distributionPath,
} from './StoragePaths';
import { RunId } from './Types';

export class FileStore {
  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(PROFILES_DIR)) {
      fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    if (!fs.existsSync(DISTRIBUTIONS_DIR)) {
      fs.mkdirSync(DISTRIBUTIONS_DIR, { recursive: true });
    }
  }

  saveProfile(runId: RunId, profile: unknown): void {
    fs.writeFileSync(profilePath(runId), JSON.stringify(profile, null, 2), 'utf-8');
  }

  saveDistribution(runId: RunId, distribution: unknown): void {
    fs.writeFileSync(distributionPath(runId), JSON.stringify(distribution, null, 2), 'utf-8');
  }
}
