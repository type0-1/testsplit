export interface JobGroup {
  id: number;
  tests: string[];
  needs?: number[];
}
