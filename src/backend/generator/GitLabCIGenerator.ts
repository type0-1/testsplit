export interface JobGroup {
  id: number;
  tests: string[];
}

export function generateGitLabCIConfig(jobs: JobGroup[]): string {
  // TODO: implement
  return '';
}
