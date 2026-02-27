import { TestResult } from '../models/TestResult';

export interface TestResultParser {
  parse(path: string): TestResult[];
}
