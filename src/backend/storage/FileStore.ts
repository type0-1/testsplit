import * as fs from 'fs';
import {
  profilesDir,
  distributionsDir,
  profilePath,
  distributionPath,
  historicalProfilePath
} from './StoragePaths';
import { RunId } from './Types';
import { Profile } from '../profiler/model/Profile'

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

  saveHistoricalProfile(historicalProfile: unknown): void {
    fs.writeFileSync(historicalProfilePath(this.baseDir), JSON.stringify(historicalProfile, null, 2), 'utf-8');
  }

  loadProfiles(): Profile[] {
    const dir = profilesDir(this.baseDir);

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    const profiles: Profile[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const fullPath = `${dir}/${file}`;

      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(raw) as Profile;
        const testCountIsNumber = typeof parsed.testCount === 'number';
        const totalDurationIsNumber = typeof parsed.totalDuration === 'number';

        // Minimal structural validation
        if (parsed && Array.isArray(parsed.testResults) && testCountIsNumber && totalDurationIsNumber) {
          profiles.push(parsed);
        }
      } catch (err) {
        console.warn(
          `Warning: failed to load profile ${file}: ${(err as Error).message}`
        );
      }
    }

    return profiles;
  }

}
