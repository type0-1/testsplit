import { execSync } from 'child_process';

export interface CommitInfo {
  sha: string;
  timestamp: string;
}

export class CommitTracker {
  static getCurrentCommit(workingDir?: string): CommitInfo | null {
    try {
      const options = workingDir ? { cwd: workingDir } : undefined;
      const sha = execSync('git rev-parse HEAD', options).toString().trim();
      const timestamp = execSync('git log -1 --format=%aI', options).toString().trim();

      if (!sha || !timestamp) {
        return null;
      }

      return { sha, timestamp };
    } catch {
      return null;
    }
  }

  static getCurrentSha(workingDir?: string): string | null {
    const commit = this.getCurrentCommit(workingDir);
    return commit?.sha ?? null;
  }

  // Git repo command referred to from: https://stackoverflow.com/questions/2180270/check-if-current-directory-is-a-git-repository
  static isGitRepository(workingDir?: string): boolean {
    try {
      const options = workingDir ? { cwd: workingDir } : undefined;
      execSync('git rev-parse --is-inside-work-tree', options);
      return true;
    } catch {
      return false;
    }
  }

}
