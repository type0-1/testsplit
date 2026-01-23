import * as fs from 'fs';
import {profilesDir, distributionsDir, profilePath, distributionPath, historicalProfilePath} from './StoragePaths';
import { RunId } from './Types';
import { Profile } from '../profiler/model/Profile'
import { DISTRIBUTION_SCHEMA_VERSION, PROFILE_SCHEMA_VERSION } from './SchemaVersions';

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
    const wrapped = {
    schemaVersion: DISTRIBUTION_SCHEMA_VERSION,
    runId,
    createdAt: new Date().toISOString(),
    distribution
  };
    fs.writeFileSync(distributionPath(runId, this.baseDir), JSON.stringify(wrapped, null, 2), 'utf-8');
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
        const parsed = JSON.parse(raw); 
        const profile: Profile | undefined = parsed && typeof parsed.schemaVersion === 'number' ? parsed.profile : parsed;

        if (!profile) {
          continue;
        }

        const testCountIsNumber = typeof profile.testCount === 'number';
        const totalDurationIsNumber = typeof profile.totalDuration === 'number';

        if (Array.isArray(profile.testResults) && testCountIsNumber && totalDurationIsNumber) {
          profiles.push(profile);
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
