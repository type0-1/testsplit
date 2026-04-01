import * as path from 'path';
import {
  DEFAULT_BASE_DIR,
  profilesDir,
  distributionsDir,
  profilePath,
  distributionPath,
  historicalProfilePath,
} from '../../../../src/backend/storage/StoragePaths';

describe('StoragePaths', () => {
  it('uses DEFAULT_BASE_DIR when profilesDir is called without baseDir', () => {
    expect(profilesDir()).toBe(path.join(DEFAULT_BASE_DIR, 'profiles'));
  });

  it('uses DEFAULT_BASE_DIR when distributionsDir is called without baseDir', () => {
    expect(distributionsDir()).toBe(path.join(DEFAULT_BASE_DIR, 'distributions'));
  });

  it('uses DEFAULT_BASE_DIR when historicalProfilePath is called without baseDir', () => {
    expect(historicalProfilePath()).toBe(
      path.join(DEFAULT_BASE_DIR, 'profiles', 'historical.json'),
    );
  });

  it('builds profile and distribution paths with default baseDir when omitted', () => {
    const runId = 'run-123';
    expect(profilePath(runId)).toBe(path.join(DEFAULT_BASE_DIR, 'profiles', `${runId}.json`));
    expect(distributionPath(runId)).toBe(
      path.join(DEFAULT_BASE_DIR, 'distributions', `${runId}.json`),
    );
  });

  it('builds all paths with an explicit baseDir', () => {
    const baseDir = '/tmp/custom';
    const runId = 'run-456';

    expect(profilesDir(baseDir)).toBe(path.join(baseDir, 'profiles'));
    expect(distributionsDir(baseDir)).toBe(path.join(baseDir, 'distributions'));
    expect(profilePath(runId, baseDir)).toBe(path.join(baseDir, 'profiles', `${runId}.json`));
    expect(distributionPath(runId, baseDir)).toBe(
      path.join(baseDir, 'distributions', `${runId}.json`),
    );
    expect(historicalProfilePath(baseDir)).toBe(
      path.join(baseDir, 'profiles', 'historical.json'),
    );
  });
});
