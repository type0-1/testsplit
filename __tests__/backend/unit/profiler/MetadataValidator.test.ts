import { MetadataValidator } from '../../../../src/backend/profiler/validation/MetadataValidator';
import { ProfileMetadata } from '../../../../src/backend/profiler/model/Profile';

const validMetadata: ProfileMetadata = {
  commit: null,
  generatedAt: '2024-01-01T00:00:00.000Z',
  cpuModel: 'Intel Core i7',
  cpuCores: 8,
  osVersion: 'macOS 14.0',
  platform: 'darwin',
  nodeVersion: 'v20.0.0',
  containerVersion: 'none',
};

describe('MetadataValidator.validate', () => {
  it('does not throw for valid metadata', () => {
    expect(() => MetadataValidator.validate(validMetadata)).not.toThrow();
  });

  it('throws when cpuModel is an empty string', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, cpuModel: '' }),
    ).toThrow('cpuModel must be a non-empty string');
  });

  it('throws when cpuCores is zero', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, cpuCores: 0 }),
    ).toThrow('cpuCores must be a positive integer');
  });

  it('throws when cpuCores is a non-integer', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, cpuCores: 1.5 }),
    ).toThrow('cpuCores must be a positive integer');
  });

  it('throws when osVersion is an empty string', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, osVersion: '' }),
    ).toThrow('osVersion must be a non-empty string');
  });

  it('throws when platform is an empty string', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, platform: '' }),
    ).toThrow('platform must be a non-empty string');
  });

  it('throws when nodeVersion is an empty string', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, nodeVersion: '' }),
    ).toThrow('nodeVersion must be a non-empty string');
  });

  it('throws when containerVersion is an empty string', () => {
    expect(() =>
      MetadataValidator.validate({ ...validMetadata, containerVersion: '' }),
    ).toThrow('containerVersion must be a non-empty string');
  });
});

describe('MetadataValidator.compareEnvs', () => {
  it('returns compatible when both environments are identical', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, validMetadata);

    expect(report.compatible).toBe(true);
    expect(report.differences).toHaveLength(0);
  });

  it('detects a platform change', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, {
      ...validMetadata,
      platform: 'linux',
    });

    expect(report.compatible).toBe(false);
    expect(report.differences).toContain('platform changed: darwin → linux');
  });

  it('detects a cpuCores change', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, {
      ...validMetadata,
      cpuCores: 4,
    });

    expect(report.compatible).toBe(false);
    expect(report.differences).toContain('cpuCores changed: 8 → 4');
  });

  it('detects an osVersion change', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, {
      ...validMetadata,
      osVersion: 'Ubuntu 22.04',
    });

    expect(report.compatible).toBe(false);
    expect(report.differences).toContain(
      'osVersion changed: macOS 14.0 → Ubuntu 22.04',
    );
  });

  it('detects a nodeVersion change', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, {
      ...validMetadata,
      nodeVersion: 'v18.0.0',
    });

    expect(report.compatible).toBe(false);
    expect(report.differences).toContain(
      'nodeVersion changed: v20.0.0 → v18.0.0',
    );
  });

  it('reports all differences when multiple fields change', () => {
    const report = MetadataValidator.compareEnvs(validMetadata, {
      ...validMetadata,
      platform: 'linux',
      cpuCores: 4,
    });

    expect(report.compatible).toBe(false);
    expect(report.differences).toHaveLength(2);
  });
});
