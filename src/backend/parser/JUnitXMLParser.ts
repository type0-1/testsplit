import { TestResult } from '../models/TestResult';
import { TestResultParser } from './TestResultParser';
import { parseJUnitXMLFile } from './JUnitXMLFileParser';
import { parseJUnitXMLPath } from './JUnitXMLPathTraversal';

export class JUnitXMLParser implements TestResultParser {
  parse(path: string): TestResult[] {
    return parseJUnitXMLPath(path, parseJUnitXMLFile);
  }
}
