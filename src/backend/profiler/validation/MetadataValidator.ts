import { ProfileMetadata } from '../model/Profile';

export interface EnvCompatibilityReport {
  compatible: boolean;
  differences: string[];
}

export class MetadataValidator {
  static validate(metadata: ProfileMetadata): void {
    if (typeof metadata.cpuModel !== 'string' || metadata.cpuModel.length === 0) {
      throw new Error('Invalid metadata: cpuModel must be a non-empty string');
    }

    if (!Number.isInteger(metadata.cpuCores) || metadata.cpuCores <= 0) {
      throw new Error('Invalid metadata: cpuCores must be a positive integer');
    }

    if (typeof metadata.osVersion !== 'string' || metadata.osVersion.length === 0) {
      throw new Error('Invalid metadata: osVersion must be a non-empty string');
    }

    if (typeof metadata.platform !== 'string' || metadata.platform.length === 0) {
      throw new Error('Invalid metadata: platform must be a non-empty string');
    }

    if (typeof metadata.nodeVersion !== 'string' || metadata.nodeVersion.length === 0) {
      throw new Error('Invalid metadata: nodeVersion must be a non-empty string');
    }

    if (typeof metadata.containerVersion !== 'string' || metadata.containerVersion.length === 0) {
      throw new Error('Invalid metadata: containerVersion must be a non-empty string');
    }
  }

  static compareEnvs(m1: ProfileMetadata, m2: ProfileMetadata ): EnvCompatibilityReport {
    const differences: string[] = [];

    if (m1.platform !== m2.platform) {
      differences.push(`platform changed: ${m1.platform} → ${m2.platform}`);
    }

    if (m1.cpuCores !== m2.cpuCores) {
      differences.push(`cpuCores changed: ${m1.cpuCores} → ${m2.cpuCores}`);
    }

    if (m1.osVersion !== m2.osVersion) {
      differences.push(`osVersion changed: ${m1.osVersion} → ${m2.osVersion}`);
    }

    if (m1.nodeVersion !== m2.nodeVersion) {
      differences.push(`nodeVersion changed: ${m1.nodeVersion} → ${m2.nodeVersion}`);
    }

    return {
      compatible: differences.length === 0,
      differences,
    };
  }
}
