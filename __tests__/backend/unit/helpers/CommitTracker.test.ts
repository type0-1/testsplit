jest.mock('child_process');

import { CommitTracker } from '../../../../src/backend/helpers/CommitTracker';
import { execSync } from 'child_process';

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('CommitTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentCommit', () => {
    it('returns commit info with sha and timestamp', () => {
      mockExecSync.mockReturnValueOnce('a1b2c3d4e5f6').mockReturnValueOnce('2026-01-28T10:30:00+00:00');
      const result = CommitTracker.getCurrentCommit();
      expect(result).toEqual({
        sha: 'a1b2c3d4e5f6',
        timestamp: '2026-01-28T10:30:00+00:00',
      });
    });

    it('returns null when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const result = CommitTracker.getCurrentCommit();
      expect(result).toBeNull();
    });

    it('returns null when sha or timestamp is empty', () => {
      mockExecSync.mockReturnValueOnce('').mockReturnValueOnce('2026-01-28T10:30:00+00:00');
      const result = CommitTracker.getCurrentCommit();

      expect(result).toBeNull();
    });

    it('accepts optional working directory', () => {
      mockExecSync.mockReturnValueOnce('a1b2c3d4e5f6').mockReturnValueOnce('2026-01-28T10:30:00+00:00');
      CommitTracker.getCurrentCommit('/custom/path');

      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.objectContaining({ cwd: '/custom/path' }));
    });
  });

  describe('getCurrentSha', () => {
    it('returns sha from getCurrentCommit', () => {
      mockExecSync.mockReturnValueOnce('a1b2c3d4e5f6').mockReturnValueOnce('2026-01-28T10:30:00+00:00');
      const result = CommitTracker.getCurrentSha();

      expect(result).toBe('a1b2c3d4e5f6');
    });

    it('returns null when not in git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const result = CommitTracker.getCurrentSha();

      expect(result).toBeNull();
    });
  });

  describe('isGitRepository', () => {
    it('returns true when in a git repository', () => {
      mockExecSync.mockReturnValueOnce('true');

      const result = CommitTracker.isGitRepository();

      expect(result).toBe(true);
    });

    it('returns false when not in a git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const result = CommitTracker.isGitRepository();

      expect(result).toBe(false);
    });
  });
});

