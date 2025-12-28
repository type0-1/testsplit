export interface JobGroup {
  id: number;
  tests: string[];
}

export function generateGitHubActionsConfig(jobs: JobGroup[]): string {
  // TODO: implement
  return '';
}
