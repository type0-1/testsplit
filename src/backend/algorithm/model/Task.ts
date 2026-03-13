export interface Task {
  id: string;
  duration: number; // measured in seconds
  dependencies?: string[];
}
