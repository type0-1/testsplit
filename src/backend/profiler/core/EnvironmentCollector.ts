import os from 'os';
import fs from 'fs';
import { ProfileMetadata } from '../model/Profile';
import { CommitInfo, CommitTracker } from '../../helpers/CommitTracker';

export class EnvironmentCollector {
  private static isRunningInDocker(): boolean {
    try {
      return fs.existsSync('/.dockerenv');
    } catch {
      return false;
    }
  }

  static collect(commit?: CommitInfo): ProfileMetadata {
    const cpus = os.cpus();

    return {
      commit: commit ?? CommitTracker.getCurrentCommit(),
      generatedAt: new Date().toISOString(),
      cpuModel: cpus[0]?.model ?? 'unknown',
      cpuCores: cpus.length,
      osVersion: typeof os.version === 'function' ? os.version() : 'unknown',
      platform: os.platform() ?? 'unknown',
      nodeVersion: process.version ?? 'unknown',
      containerVersion: EnvironmentCollector.isRunningInDocker() ? (process.env.CONTAINER_VERSION ?? 'docker') : 'none',
    };
  }
}