import * as fs from 'fs';
import * as zlib from 'zlib';
import * as path from 'path';

import { profilesDir, distributionsDir, profilePath, distributionPath, historicalProfilePath } from './StoragePaths';
import { RunId } from './Types';
import { Profile } from '../profiler/model/Profile';
import { DISTRIBUTION_SCHEMA_VERSION } from './SchemaVersions';
import { HistoricalDelta } from '../models/HistoricalDelta';
import { StoredHistoricalDelta } from '../models/StoredHistoricalDelta';
import { HistoricalProfile } from '../models/HistoricalProfile';

const DELTAS_DIR = 'history/deltas';
const MAX_UNCOMPRESSED_DELTAS = 50;
const MAX_ARCHIVED_DELTAS = 500; // Arbitrary max limit, will modify these vals later on as we figure things out

export class FileStore {
  constructor(private baseDir: string = '.data') {
    this.ensureDirectories();
    this.ensureDeltasDir();
  }

  private ensureDirectories(): void {
    fs.mkdirSync(profilesDir(this.baseDir), { recursive: true });
    fs.mkdirSync(distributionsDir(this.baseDir), { recursive: true });
  }

  private deltasDir(): string {
    return path.join(this.baseDir, DELTAS_DIR);
  }

  private ensureDeltasDir(): void {
    fs.mkdirSync(this.deltasDir(), { recursive: true });
  }

  // Method to integrate preventive measures for infinite file storage growth (compress old delta files)
  private rotateHistoricalDeltas(): void {
    const dir = this.deltasDir();
    const jsonFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f.startsWith('delta-')).sort();
    const toCompress = jsonFiles.slice(0, Math.max(0, jsonFiles.length - MAX_UNCOMPRESSED_DELTAS));

    for (const file of toCompress) {
      const fullPath = path.join(dir, file);
      const raw = fs.readFileSync(fullPath);
      const compressed = zlib.gzipSync(raw);

      fs.writeFileSync(`${fullPath}.gz`, compressed);
      fs.unlinkSync(fullPath);
    }
  }

  private cleanupOldArchivedDeltas(): void {
    const dir = this.deltasDir();
    const gzFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();

    if (gzFiles.length <= MAX_ARCHIVED_DELTAS) {
      return;
    }

    const toDelete = gzFiles.slice(0, gzFiles.length - MAX_ARCHIVED_DELTAS);

    for (const file of toDelete) {
      fs.unlinkSync(path.join(dir, file));
    }
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
    // Strip raw profiles array before persisting - it holds full testResults for every
    // run and grows unboundedly. Only derived stats (perTestStats, metadata, aggregates)
    // are needed by the API and future profiling runs.
    const { profiles: _, ...rest } = historicalProfile as Record<string, unknown>;
    const json = JSON.stringify(rest);
    const compressed = zlib.gzipSync(Buffer.from(json, 'utf-8'));
    fs.writeFileSync(historicalProfilePath(this.baseDir), compressed);
  }

  saveHistoricalDeltas(deltas: HistoricalDelta): void {
    const dir = this.deltasDir();

    const timestamp = `${Date.now()}-${process.hrtime.bigint()}`; // adding uniqueness for timestamp field (nanosecond accuracy via hrtime)
    const filename = `delta-${timestamp}.json`;
    const fullPath = path.join(dir, filename);

    const payload: StoredHistoricalDelta = {
      createdAt: new Date().toISOString(),
      deltas
    };

    fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf-8');

    this.rotateHistoricalDeltas();
    this.cleanupOldArchivedDeltas();
  }

  loadHistoricalDeltas(limit: number = 10): StoredHistoricalDelta[] {
    const dir = this.deltasDir();

    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('delta-'))
      .sort()
      .reverse()
      .slice(0, limit);

    const results: StoredHistoricalDelta[] = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);

      try {
        if (file.endsWith('.gz')) {
          const compressed = fs.readFileSync(fullPath);
          const raw = zlib.gunzipSync(compressed).toString('utf-8'); // use gzip alg for compression -> raw
          results.push(JSON.parse(raw));
        } else {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          results.push(JSON.parse(raw));
        }
      } catch {
        console.warn(`Warning: failed to load delta ${file}`);
      }
    }

    return results;
  }

  loadHistoricalProfile(): HistoricalProfile | null {
    const filePath = historicalProfilePath(this.baseDir);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const compressed = fs.readFileSync(filePath);
      const raw = zlib.gunzipSync(compressed).toString('utf-8');
      return { ...JSON.parse(raw), profiles: [] } as HistoricalProfile;
    } catch {
      return null;
    }
  }

  loadLatestDistribution(): unknown | null {
    const dir = distributionsDir(this.baseDir);

    if (!fs.existsSync(dir)) {
      return null;
    }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();

    if (files.length === 0) {
      return null;
    }

    try {
      const raw = fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed.distribution ?? parsed;
    } catch {
      return null;
    }
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
        const profile: Profile | undefined = parsed?.profile ?? parsed;

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
